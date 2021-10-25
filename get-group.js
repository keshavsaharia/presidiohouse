// Load environment variables from configuration file
require('dotenv').config()

const Splitwise = require('splitwise')

const sw = Splitwise({
	consumerKey: process.env.SPLITWISE_KEY,
	consumerSecret: process.env.SPLITWISE_SECRET
})

async function main() {
	const groups = await sw.getGroups()

	groups.forEach((group) => {
		if (group.id == 0)
			return
		console.log('Group: ' + group.name + ' (' + group.id + ')')
		console.log(' - ' + group.members.length + ' member' + (group.members.length == 1 ? '' : 's'))
		group.members.forEach((member) => {
			console.log('   - ' + member.first_name + ' ' + (member.last_name || '') + ' (' + member.id + ')')
		})
	})
}

main()
