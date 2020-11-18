# creds-loader

**Currently in development, not yet ready for use**

This is a NodeJS package for loading a users credentials from various places. Credentials are specified in a config object which
would typically be loaded from file. The simplest way to specify credentials is with a `username` and `password` in the object.
Alternatively, you can specify various other sources including environment variables, another file, 1password, your system keychain,
or read from user input.

## Basic Use

You provide an object containing the creds and a path to where they're specified. The library will look at the property value in that path
and determine how to get the specified value. The following shows the various ways to specify a value in an object:

```typescript
({
    /**
     * Provide the value directly.
     */
    directValue: string;

    /**
     * Load the value from an environment variable.
     */
    envVar: {
        /**
         * The name of the environment variable.
         */
        ENV: string;
    };

    /**
     * Load from the Operating system's keychain, where applicable.
     * Returns the password from the entry.
     */
    systemKeyChain: {
        KEYCHAIN: {
            account: string;
            service: string;
        }
    },

    /**
     * Get an item from 1Password. Must have the
     * [1password command-line tool](https://support.1password.com/command-line-getting-started/)
     * installed.
     */
    from1PasswordByUUID: {
        "1PASSWORD": {
            /**
             * Specify the UUID of the item. You can use the op command line tool to get this, or
             * using the desktop 1password app you'll need to go into advanced preferences and enable
             * the "Copy UUID" menu item.
             */
            uuid: string;

            /**
             * Specify the name of the field to load from the 1Password item. This defaults to the password
             * field.
             *
             * You can also provide an array of field names and the resulting value will be an _object_ with
             * the specified field names as property names and the corresponding field values as property values.
             *
             * Or, specify an object whose property values specify the field name to use for that property value.
             */
            field: string? | Array<string> | Record<string>;

            /**
             * Optionally specify which vault to use.
             */
            vault: string?;

            /**
             * Optionally include items in your 1Password trash. Default is false.
             */
            includeTrash: boolean?;
        }
    }
})
```
