// Load environment variables from configuration file
require('dotenv').config()

const Splitwise = require('splitwise')
const readline = require('readline')
const { stdin: input, stdout: output } = require('process')

// Get the configuration JSON file for expenses
const expenses = require('./expenses.json')

const rl = readline.createInterface({ input, output })

const sw = Splitwise({
	consumerKey: process.env.SPLITWISE_KEY,
	consumerSecret: process.env.SPLITWISE_SECRET
})

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

async function ask(q) {
	return new Promise((resolve) => {
		rl.question(q, (answer) => {
			resolve(answer)
		})
	})
}

function getMember(group, name) {
	name = name.toLowerCase()

	const member = group.members.find((m) => {
		if (m.first_name.toLowerCase() == name)
			return true
		if ((m.first_name + ' ' + m.last_name).toLowerCase() == name)
			return true
	})

	return member
}

function getMemberId(group, name) {
	const member = getMember(group, name)
	if (member)
		return member.id
	return null
}

function getExpenseUsers(group, house, expense) {
	// If only names are passed in the array, equally split the amount between
	// the listed members
	const equalSplit = expense.member.every((m) => (typeof m === 'string'))
	let users = []

	// If equal split, divide between members and randomly add cents to ensure the
	// total of each owed amount aligns with the total expense amount.
	if (equalSplit)
		users = getExpenseEqualSplit(group, expense)
	// If explicit split, map each owed share. This will produce an error if the total
	// amount does not match the sum of the total owed amounts.
	else
		users = getExpenseExactSplit(group, expense)


	users.splice(0, 0, {
		user_id: house,
		paid_share: expense.amount,
		owed_share: 0
	})

	users.forEach((user) => {
		user.paid_share = user.paid_share / 100.0
		user.owed_share = user.owed_share / 100.0
	})

	return users
}

function getExpenseExactSplit(group, expense) {
	return expense.member.map((member) => ({
		user_id: getMemberId(group, member.name),
		paid_share: 0,
		owed_share: member.amount
	}))
}

function getExpenseEqualSplit(group, expense) {
	// Store total owed
	let totalOwed = 0

	// Map each user to their ID and the initial amount owed
	const users = expense.member.map((name) => {
		// Floor the share to get a base owed amount
		const owed = Math.floor(1.0 * expense.amount / expense.member.length)
		totalOwed += owed

		return {
			user_id: getMemberId(group, name),
			paid_share: 0,
			owed_share: owed
		}
	})

	// While the total owed is off by the number of members or more, add/subract 1 cent
	// to get closer to the expense amount
	while (Math.abs(totalOwed - expense.amount) >= users.length) {
		const amount = (totalOwed > expense.amount ? -1 : 1)
		users.forEach((user) => {
			user.owed_share += amount
		})
		totalOwed += amount * users.length
	}
	// While the total owed is off by 1 cent or more, randomly add or subtract a
	// cent from a random set of users from this expense
	if (Math.abs(totalOwed - expense.amount) >= 1) {
		const amount = (totalOwed > expense.amount ? -1 : 1)
		users.sort((a, b) => (Math.random() - 0.5)).slice(0, Math.abs(totalOwed - expense.amount)).forEach((user) => {
			user.owed_share += amount
		})
	}

	return users
}

function createExpenseRequest(group, house, expense, month) {
	// If only names are passed in the array, equally split the amount between
	// the listed members
	const equalSplit = expense.member.every((m) => (typeof m === 'string'))

	// Convert estimates by month to amount
	let amount = expense.amount
	if (Array.isArray(amount))
		amount = amount[month]

	// The expense object passed to SplitWise
	const splitwise = {
		group_id: group.id,
		cost: amount / 100.0,
		currency_code: 'USD',
		category_id: expense.category,
		description: ((expense.estimate != null) ? 'Estimated ' : '') + expense.name + ' (' + MONTH[month] + ')',
		creation_method: 'equal',
		users: getExpenseUsers(group, house, expense)
	}

	return splitwise
}

function updateExpenseRequest(group, house, existingExpense, expense, month) {
	const splitwise = {
		id: existingExpense.id,
		description: expense.name + ' (' + MONTH[month] + ')',
		cost: expense.amount / 100.0,
		users: getExpenseUsers(group, house, expense)
	}

	return splitwise
}

async function main() {
	// Get the group for this configuration
	const group_id = process.env.SPLITWISE_GROUP_ID
	const group = await sw.getGroup({ id: group_id })
	console.log('Managing expenses for ' + group.name + ' (' + group.id + ')')

	// House ID
	const house = parseInt(process.env.SPLITWISE_HOUSE_ID)

	// Get the month ID
	const currentMonth = new Date().getMonth()
	const currentYear = new Date().getFullYear()
	const nextMonth = (currentMonth + 1) % 12

	let create = await ask('Create expenses for ' + MONTH[nextMonth] + '? (y/N) ')

	if (create.toLowerCase().charAt(0) == 'y')
		for (let i = 0 ; i < expenses.length ; i++) {
			console.log(' - Creating expense for ' + expenses[i].name)
			await sw.createExpense(createExpenseRequest(
				group, house, expenses[i], nextMonth
			))
		}

	// Update estimated expenses for past months
	for (let i = 0 ; i < expenses.length ; i++) {
		const expense = expenses[i]

		if (expense.estimate != null) {
			const estimateMonth = (currentMonth + 12 + expense.estimate) % 12
			const estimateValue = parseFloat(await ask(expense.name + ' for ' + MONTH[estimateMonth] + ': '))

			if (! isNaN(estimateValue)) {
				const pastDescription = 'Estimated ' + expense.name + ' (' + MONTH[estimateMonth] + ')'
				console.log(' - Searching for expense "' + pastDescription + '"')
				let pastExpenses = await sw.getExpenses({
					group_id,
					dated_after: new Date((estimateMonth > currentMonth) ? (currentYear - 1) : currentYear, estimateMonth - 1, 1).toISOString(),
					dated_before: new Date((estimateMonth > currentMonth) ? (currentYear - 1) : currentYear, estimateMonth, 14).toISOString(),
					limit: 100
				})
				let pastEstimate = pastExpenses.find((e) => (e.description == pastDescription))

				if (pastEstimate) {
					console.log(' - Found past estimate for ' + MONTH[estimateMonth] + ' at $' + pastEstimate.cost)
					await sw.updateExpense(updateExpenseRequest(group, house, pastEstimate, {
						...expense,
						amount: estimateValue * 100
					}, estimateMonth))
					console.log(' - Updated estimate for ' + MONTH[estimateMonth] + ' from $' + pastEstimate.cost + ' to $' + estimateValue)
				}
			}
		}
	}


	// End process
	rl.close()
	process.exit(0)
}

main()
