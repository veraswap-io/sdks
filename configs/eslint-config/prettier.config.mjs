export default {
    semi: true,
    trailingComma: 'all',
    singleQuote: false,
    printWidth: 120,
    tabWidth: 4,
    overrides: [
        {
            files: "*.json",
            options: {
                tabWidth: 2,
            }
        }
    ]
}
