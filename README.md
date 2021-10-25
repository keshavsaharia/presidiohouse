# Presidio House

This is a set of scripts for managing shared expenses in a Presidio house.

- [Create Expenses](./create-expenses.js) - create shared expense objects
- [Get Splitwise IDs](./get-group.js) - get group IDs and member IDs for initial configuration

You will need a `.env` file and to create an `expenses.json` file. You can use the
[example](./sample-expenses.json) as a starter.

## Creating environment file

You will need to get the `CLIENT KEY` and `CLIENT SECRET` by [registering an app](https://secure.splitwise.com/apps). You can
retrieve the value for `GROUP ID` and a list of members (select the member ID of the house for `HOUSE ID`) by first filling the
splitwise key and secret, then running the `get-group.js` script.

```
SPLITWISE_GROUP_ID="{ GROUP ID }"
SPLITWISE_HOUSE_ID="{ HOUSE ID }"
SPLITWISE_KEY="{ CLIENT KEY }"
SPLITWISE_SECRET="{ CLIENT SECRET }"
```

You can also get the group ID from the URL on splitwise.com - it is the number part of `https://secure.splitwise.com/#/groups/123456` (i.e. `123456`). Similarly, click on the house member URL to get `https://secure.splitwise.com/#/friends/1234567` (i.e. `1234567` is `HOUSE ID`).

## Run the script to create expenses

Create all Splitwise expenses for the upcoming month with the `create-expenses.js` script.

```
$ node create-expenses.js

Managing expenses for Example House (1234567)
Create expenses for November? (y/N) y
 - Creating expense for Rent
 - Creating expense for Utilities
 - Creating expense for Gas
 - Creating expense for House Fund
 - Creating expense for Trash
 - Creating expense for Internet
 - Creating expense for Parking
Utilities for August: 415.19
 - Searching for expense "Estimated Utilities (August)"
 - Found past estimate for August at $378.0
 - Updated estimate for August from $378.0 to $415.19
Gas for September: 126.03
 - Searching for expense "Estimated Gas (September)"
 - Found past estimate for September at $120.0
 - Updated estimate for September from $120.0 to $126.03
```

## Notes

- The `expenses.json` file contains an array of expense objects described below
- By default, the script assumes you are running split payments for the upcoming month on time
- All amounts are in cents, this helps deal with floating-point rounding issues
- First names are ideal for looking up a user's Splitwise ID, you can also specify first and last name (e.g. "John Doe") - names are case insensitive

## Explicit split expense

Certain expenses like rent are explicitly split between members. The total amount
must add up to the sum of member amounts.

```
{
	"name": "Rent",
	"amount": 505000,
	"category": 3,
	"member": [
		{ "name": "john", "amount": 200000 },
		{ "name": "jane", "amount": 150000 },
		{ "name": "jacob", "amount": 155000 }
	]
}
```

## Shared expense

Some expenses may be shared by some or all of the members of the house. You can easily
split the amount equally between members by simply specifying the name as a string in
the `member` array.

```
{
	"name": "Parking",
	"amount": 10000,
	"category": 18,
	"member": [
		"john",
		"jane"
	]
}
```

## Estimated expense

By adding the `estimate` key and the number of months the expense is offset by, you can update the expense in the given number of months when the script is run again.
This is useful because the Presidio charges for utilities (electricity, water, sewage) with a two month delay.

```
{
	"name": "Utilities",
	"estimate": -2,
	"member": [
		...
	]
}
```

## Roadmap

- Create a web service with Splitwise OAuth login
