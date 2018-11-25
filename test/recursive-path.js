const assert = require('assert');
const data = require('./fixture/simple');
const query = require('../src');

function addUnique(arr, items) {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (arr.indexOf(item) === -1) {
            arr.push(item);
        }
    }

    return arr;
}

describe('recursive path', () => {
    it('should collect a subtree', () => {
        const context = data[5];
        const expected = addUnique([], context.deps);

        for (let i = 0; i < expected.length; i++) {
            addUnique(expected, expected[i].deps);
        }

        assert.deepEqual(
            query('#..deps.filename')(data, context).sort(),
            expected
                .map(item => item.filename)
                .sort()
        );
    });

    it('should allow queries in parentheses', () => {
        const context = data[5];
        const expected = [];
        context.dependants.forEach(item => addUnique(expected, item.deps));

        for (let i = 0; i < expected.length; i++) {
            expected[i].dependants.forEach(item => addUnique(expected, item.deps));
        }

        // build dependants deps cluster
        assert.deepEqual(
            query('#..(dependants.deps).filename')(data, context).sort(),
            expected
                .map(item => item.filename)
                .sort()
        );
    });

    it('should allow expressions in parentheses', () => {
        const context = data[5];
        const expected = [];
        addUnique(expected, context.deps);
        addUnique(expected, context.dependants);

        for (let i = 0; i < expected.length; i++) {
            addUnique(expected, expected[i].deps);
            addUnique(expected, expected[i].dependants);
        }

        // build a dependancy cluster
        assert.deepEqual(
            query('#..(deps + dependants).filename')(data, context).sort(),
            expected
                .map(item => item.filename)
                .sort()
        );
    });

    it('should allow to be a subquery', () => {
        const expected = [];

        data.forEach(item =>
            item.errors
                .map(error => error.owner)
                .forEach(item => addUnique(expected, item.deps))
        );

        for (let i = 0; i < expected.length; i++) {
            addUnique(expected, expected[i].deps);
        }

        assert.deepEqual(
            query('errors.owner..deps.filename')(data).sort(),
            expected
                .map(item => item.filename)
                .sort()
        );
    });

    it('should allow expressions as a subquery', () => {
        const expected = [];

        data.forEach(item =>
            item.errors
                .map(error => error.owner)
                .forEach(item => {
                    addUnique(expected, item.deps);
                    addUnique(expected, item.dependants);
                })
        );

        for (let i = 0; i < expected.length; i++) {
            addUnique(expected, expected[i].deps);
            addUnique(expected, expected[i].dependants);
        }

        assert.deepEqual(
            query('errors.owner..(deps + dependants).filename')(data).sort(),
            expected
                .map(item => item.filename)
                .sort()
        );
    });

    it('include context to a result', () => {
        const context = data[5];
        const expected = addUnique([context], context.deps);

        for (let i = 0; i < expected.length; i++) {
            addUnique(expected, expected[i].deps);
        }

        assert.deepEqual(
            query('(# + #..deps).filename')(data, context).sort(),
            expected
                .map(item => item.filename)
                .sort()
        );
    });
});