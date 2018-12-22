const assert = require('assert');
const query = require('../src');
const data = {
    foo: [
        { a: 1, b: 2},
        { b: 3, c: 4},
        {},
        { d: 5 }
    ],
    bar: 2
};

function suggestQuery(str, data, context) {
    const suggestPoints = [];
    const clearedStr = str.replace(/\|/g, (m, idx) => {
        suggestPoints.push(idx - suggestPoints.length);
        return '';
    });

    return suggestPoints.map(idx =>
        query(clearedStr, { suggest: true })(data, context, idx)
    );
}

function suggestion(current, list, from, to = from) {
    return {
        context: 'path',
        current,
        list: list.map(text => 'property:' + text),
        from,
        to
    };
}

describe('suggest', () => {
    it('empty query', () => {
        assert.deepEqual(
            suggestQuery('|', data),
            [
                suggestion('', ['foo', 'bar'], 0, 0)
            ]
        );
    });

    it('simple path', () => {
        const foo = suggestion('foo', ['foo', 'bar'], 0, 3);
        const bar = suggestion('bar', ['a', 'b', 'c', 'd'], 4, 7);

        assert.deepEqual(
            suggestQuery('|f|o|o|.|b|a|r|', data),
            [
                ...Array(4).fill(foo),
                ...Array(4).fill(bar)
            ]
        );
    });

    Object.entries({
        filter: ['.[', ']'],
        map: ['.(', ')'],
        recursiveMap: ['..(', ')'],
        object: ['.({', '})'],
        array: ['.([', '])']
    }).forEach(([name, [begin, end]]) => {
        const sbegin = begin.replace(/./g, '$&|');
        const send = end.replace(/./g, '$&|');

        describe(name, () => {
            Object.entries({
                '': ['foo', 'bar'],
                foo: ['a', 'b', 'c', 'd']
            }).forEach(([prefix, list]) => {
                describe('with prefix `' + prefix + '`', () => {
                    const emptyQuery = `${prefix}${sbegin}${send}`;
                    it('empty: ' + emptyQuery, () => {
                        assert.deepEqual(
                            suggestQuery(emptyQuery, data),
                            [
                                ...Array(begin.length - 1).fill(null),
                                suggestion('', list, prefix.length + begin.length),
                                ...Array(end.length).fill(null)
                            ]
                        );
                    });

                    const wsQuery = `${prefix}${sbegin} | | |${send}`;
                    it('ws: ' + wsQuery, () => {
                        assert.deepEqual(
                            suggestQuery(wsQuery, data),
                            [
                                ...Array(begin.length - 1).fill(null),
                                suggestion('', list, prefix.length + begin.length + 0),
                                suggestion('', list, prefix.length + begin.length + 1),
                                suggestion('', list, prefix.length + begin.length + 2),
                                suggestion('', list, prefix.length + begin.length + 3),
                                ...Array(end.length).fill(null)
                            ]
                        );
                    });

                    const tokenQuery = `${prefix}${sbegin} |b|a|z| |${send}`;
                    it('with a token: ' + tokenQuery, () => {
                        const from = prefix.length + begin.length + 1;
                        const to = prefix.length + begin.length + 4;

                        assert.deepEqual(
                            suggestQuery(tokenQuery, data),
                            [
                                ...Array(begin.length).fill(null),
                                suggestion('baz', list, from, to),
                                suggestion('baz', list, from, to),
                                suggestion('baz', list, from, to),
                                suggestion('baz', list, from, to),
                                ...Array(end.length + 1).fill(null)
                            ]
                        );
                    });
                });
            });
        });
    });

    it('object context', () => {
        assert.deepEqual(
            suggestQuery('{| |a|,| |b| |}', data),
            [
                null,
                suggestion('a', ['foo', 'bar'], 2, 3),
                suggestion('a', ['foo', 'bar'], 2, 3),
                null,
                suggestion('b', ['foo', 'bar'], 5, 6),
                suggestion('b', ['foo', 'bar'], 5, 6),
                null
            ]
        );
    });

    it('array context', () => {
        assert.deepEqual(
            suggestQuery('[| |a|,| |b| |]', data),
            [
                null,
                suggestion('a', ['foo', 'bar'], 2, 3),
                suggestion('a', ['foo', 'bar'], 2, 3),
                null,
                suggestion('b', ['foo', 'bar'], 5, 6),
                suggestion('b', ['foo', 'bar'], 5, 6),
                null
            ]
        );
    });

    describe('method context', () => {
        ['', '.', '$.'].forEach(prefix => {
            describe(`${prefix}method(...)`, () => {
                it('no arguments', () => {
                    assert.deepEqual(
                        suggestQuery(prefix + 'size(| | |)', data),
                        [
                            suggestion('', ['foo', 'bar'], prefix.length + 5),
                            suggestion('', ['foo', 'bar'], prefix.length + 6),
                            suggestion('', ['foo', 'bar'], prefix.length + 7)
                        ]
                    );
                });

                it('single argument', () => {
                    assert.deepEqual(
                        suggestQuery(prefix + 'size(| |a| |)', data),
                        [
                            null,
                            suggestion('a', ['foo', 'bar'], prefix.length + 6, prefix.length + 7),
                            suggestion('a', ['foo', 'bar'], prefix.length + 6, prefix.length + 7),
                            null
                        ]
                    );
                });

                it('multiple arguments', () => {
                    assert.deepEqual(
                        suggestQuery(prefix + 'size(| |a|,| |b|,| |c| |,| |d| |)', data),
                        [
                            null,
                            suggestion('a', ['foo', 'bar'], prefix.length + 6, prefix.length + 7),
                            suggestion('a', ['foo', 'bar'], prefix.length + 6, prefix.length + 7),
                            null,
                            suggestion('b', ['foo', 'bar'], prefix.length + 9, prefix.length + 10),
                            suggestion('b', ['foo', 'bar'], prefix.length + 9, prefix.length + 10),
                            null,
                            suggestion('c', ['foo', 'bar'], prefix.length + 12, prefix.length + 13),
                            suggestion('c', ['foo', 'bar'], prefix.length + 12, prefix.length + 13),
                            null,
                            null,
                            suggestion('d', ['foo', 'bar'], prefix.length + 16, prefix.length + 17),
                            suggestion('d', ['foo', 'bar'], prefix.length + 16, prefix.length + 17),
                            null
                        ]
                    );
                });
            });
        });
    });
});

describe('suggest: autocorrection', () => {
    it('trailing full stop', () => {
        assert.deepEqual(
            suggestQuery('.|', data),
            [
                suggestion('', ['foo', 'bar'], 1, 1)
            ]
        );

        assert.deepEqual(
            suggestQuery('.foo.|', data),
            [
                suggestion('', ['a', 'b', 'c', 'd'], 5, 5)
            ]
        );
    });

    it('trailing double full stop', () => {
        assert.deepEqual(
            suggestQuery('.|.|', data),
            [
                null,
                suggestion('', ['foo', 'bar'], 2, 2)
            ]
        );

        assert.deepEqual(
            suggestQuery('.foo.|.|', data),
            [
                null,
                suggestion('', ['a', 'b', 'c', 'd'], 6, 6)
            ]
        );
    });

    it('nested trailing full stop', () => {
        assert.deepEqual(
            suggestQuery('.foo.[.|].|', data),
            [
                suggestion('', ['a', 'b', 'c', 'd'], 7),
                suggestion('', [], 9)
            ]
        );
    });

    it('trailing full stop with trailing whitespaces', () => {
        assert.deepEqual(
            suggestQuery('.| |', data),
            [
                suggestion('', ['foo', 'bar'], 1),
                suggestion('', ['foo', 'bar'], 2)
            ]
        );

        assert.deepEqual(
            suggestQuery('.|\n  ', data),
            [
                suggestion('', ['foo', 'bar'], 1)
            ]
        );
    });

    it('trailing full stop with trailing comment', () => {
        assert.deepEqual(
            suggestQuery('.|//', data),
            [
                suggestion('', ['foo', 'bar'], 1)
            ]
        );

        assert.deepEqual(
            suggestQuery('.|  //', data),
            [
                suggestion('', ['foo', 'bar'], 1)
            ]
        );

        assert.deepEqual(
            suggestQuery('.|  //1\n  //2\n//3\n  ', data),
            [
                suggestion('', ['foo', 'bar'], 1)
            ]
        );

        assert.deepEqual(
            suggestQuery('.foo.|//', data),
            [
                suggestion('', ['a', 'b', 'c', 'd'], 5)
            ]
        );
    });

    it('trailing comma', () => {
        assert.deepEqual(
            suggestQuery('[foo,|]', data),
            [
                suggestion('', ['foo', 'bar'], 5)
            ]
        );
    });

    describe('operators', () => {
        [
            '+', '-', '*', '/', '%',
            '=', '!=', '~=', '>=', '<=', /* '<',*/ '>'
        ].forEach(operator => {
            (['/', '~='].includes(operator) ? it.skip : it)('foo ' + operator, () => {
                assert.deepEqual(
                    suggestQuery('foo ' + operator + '| |', data),
                    [
                        suggestion('', ['foo', 'bar'], operator.length + 4),
                        suggestion('', ['foo', 'bar'], operator.length + 5)
                    ]
                );
            });
        });

        [
            'true and', 'false or', 'foo in', 'foo not in', 'no', 'not'
        ].forEach(queryString => {
            it(queryString + '| |', () => {
                assert.deepEqual(
                    suggestQuery(queryString + '| |', data),
                    [
                        null,
                        suggestion('', ['foo', 'bar'], queryString.length + 1)
                    ]
                );
            });

            it(queryString + '|[|]', () => {
                assert.deepEqual(
                    suggestQuery(queryString + '|[|]', data),
                    [
                        null,
                        suggestion('', ['foo', 'bar'], queryString.length + 1)
                    ]
                );
            });
        });
    });
});
