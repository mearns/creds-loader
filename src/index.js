const keytar = require("keytar");

const UNKNOWN = Symbol("unknown");
const RAW = Symbol("raw");
const ENV = Symbol("env");
const KEYCHAIN = Symbol("keychain");
const ONEPASSWORD = Symbol("1Password");
const ASK = Symbol("ask");

function detectType(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0) {
            return RAW;
        } else if (keys.length !== 1) {
            return UNKNOWN;
        }
        const [onlyKey] = keys;
        switch (onlyKey) {
            case "RAW":
                return RAW;
            case "ENV":
                return ENV;
            case "KEYCHAIN":
                return KEYCHAIN;
            case "1PASSWORD":
                return ONEPASSWORD;
            case "ASK":
                return ASK;
            default:
                return UNKNOWN;
        }
    } else {
        return RAW;
    }
}

async function transform(value, opts = {}) {
    const valueType = detectType(value);
    switch (valueType) {
        case RAW:
            return value;
        case ENV:
            return transformEnv(value.ENV, getTypeOptions("env", opts));
        case KEYCHAIN:
            return transformKeychain(
                value.KEYCHAIN,
                getTypeOptions("keychain", opts)
            );
        case ONEPASSWORD:
            return transform1Password(
                value["1PASSWORD"],
                getTypeOptions("1password", opts)
            );
        case ASK:
            return transformAsk(value["ASK"], getTypeOptions("ask", opts));
        default:
            throw new Error(`Unsupported transform type ${String(valueType)}`);
    }
}

async function transform1Password(
    value,
    { allowUnknownProperties = false, allowUndefined = false } = {}
) {
    const { uuid, vault, includeTrash, field } = validateObject(
        value,
        ["uuid"],
        ["value", "includeTrash", "field"],
        allowUnknownProperties
    );
}

async function transformKeychain(
    value,
    { allowUnknownProperties = false, allowUndefined = false } = {}
) {
    const { service, account } = validateObject(
        value,
        ["service", "account"],
        [],
        allowUnknownProperties
    );
    const password = await keytar.getPassword(service, account);
    if (password === null && !allowUndefined) {
        throw Object.assign(
            new Error(
                `Could not find keychain entry for account ${account} and service ${service}`
            ),
            { service, account }
        );
    }
    return password;
}

async function transformEnv(value, { allowUndefined = false } = {}) {
    if (typeof value !== "string") {
        throw new TypeError(
            `Unexpected value for ENV type: expected a string, found a ${typeof value}`
        );
    }
    if (Object.hasOwnProperty.call(process.env, value)) {
        return process.env[value];
    }
    if (!allowUndefined) {
        throw new Error(
            `The requested environment variable "${value}" is not defined.`
        );
    }
}

/**
 * Given a global object of properties, gets the properties for the specific type.
 * This merges the options for the specified type over the top-level properties of
 * `opts`. Both sets of options default to an empty object if falsey.
 * @param {string} typeName
 * @param {object} [opts]
 */
function getTypeOptions(typeName, opts) {
    const safeOpts = opts || {};
    return {
        ...safeOpts,
        ...(safeOpts[typeName] || {})
    };
}

/**
 * @param {object} object The object to validate
 * @param {Array<string>} requireProperties An array of property names that are required to be present in the object.
 * @param {Array<string>} optionalProperties An array of property names that are optional.
 * @param {boolean} allowUnknownProperties Whether or not to allow unknown properties in the object. If this is false
 * and the object has any enumerable-properties other than those specified in `requiredProperties` and `optionalProperties`
 * arrays, then an error will be thrown.
 */
function validateObject(
    object,
    requireProperties,
    optionalProperties,
    allowUnknownProperties
) {
    if (typeof object !== "object") {
        throw new TypeError(`Expected an object, found a ${typeof value}`);
    } else if (object === null) {
        throw new TypeError(`Expected an object, found null`);
    }
    const missingProperties = requireProperties.filter(
        k => !Object.hasOwnProperty.call(object, k)
    );
    if (missingProperties.length) {
        throw Object.assign(
            new Error(
                `Missing required properties: ${missingProperties.join(", ")}`
            ),
            { requireProperties, missingProperties }
        );
    }
    if (!allowUnknownProperties) {
        const allowedProperties = new Set([
            ...requireProperties,
            ...optionalProperties
        ]);
        const unexpectedProperties = Object.keys(object).filter(
            k => !allowedProperties.has(k)
        );
        if (unexpectedProperties.length) {
            throw Object.assign(
                new Error(
                    `Unexpected properties found: ${unexpectedProperties.join(
                        ", "
                    )}`
                ),
                {
                    allowedProperties: [...allowedProperties],
                    unexpectedProperties
                }
            );
        }
    }

    return optionalProperties.reduce(
        (res, k) => {
            if (Object.hasOwnProperty.call(object, k)) {
                res[k] = object[k];
            }
            return res;
        },
        requireProperties.reduce((res, k) => {
            res[k] = object[k];
            return res;
        }, {})
    );
}
