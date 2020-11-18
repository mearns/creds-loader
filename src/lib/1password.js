const exec = require("just-run-it");
const { spawn } = require("child_process");
const Prompt = require("prompt-password");

class OnePasswordClient {
    /**
     *
     * @param {object} options
     * @param {null | (string) => Promise<string>} [options.ask] This is a function which takes a prompt as a string
     * and returns a promise for the user's 1password master key. The default uses the "prompt-password" to ask for
     * the password from the terminal, with input masking. If you have trouble with this, pass `null` for this value
     * and we'll let the `op` command prompt and recieve the password itself.
     * @param {boolean} [options.allowSignin=true] If the 1password cli is not signed in, this will allow us to
     * perform an interactive signin which includes asking the user for their password (see `options.ask`). If you don't
     * want to do that, then set this to false and we'll throw an error if the 1password cli isn't signed in.
     */
    constructor({
        account = "my",
        cache,
        config,
        command = "op",
        allowSignin = true,
        ask = message => new Prompt({ message }).run()
    } = {}) {
        this._account = account;
        this._allowSignin = allowSignin;
        this._ask = ask;
        this._opCommand = command;
        this._commonArgs = ["--account", account];
        if (cache) {
            this._commonArgs.push("--cache");
        }
        if (config) {
            this._commonArgs.push("--config", config);
        }
        this._sessionToken = process.env[`OP_SESSION_${account}`];
    }

    /**
     * The absolute bottom of the call stack in this class when invoking a 1password
     * cli command. This adds in the common arguments including the current session token.
     */
    async _exec(command, ...args) {
        const execArgs = [
            this._opCommand,
            command,
            ...this._commonArgs,
            "--session",
            this._sessionToken || "",
            ...args
        ];
        return exec(execArgs, {
            quiet: true
        });
    }

    /**
     * Run a 1password cli command. If we are allowed to do a sign-in,
     * then this will ensure we are signed in, and ask the user if we're not.
     */
    async _runCommand(command, ...args) {
        await this._ensureSignedIn();
        return this._exec(command, ...args);
    }

    async _ensureSignedIn() {
        try {
            const stdout = await this._execSigninCommand(
                [
                    "signin",
                    "--raw",
                    ...this._commonArgs,
                    "--session",
                    this._sessionToken || ""
                ],
                " "
            );
            this._sessionToken = stdout.trim();
        } catch (error) {
            // Not signed in, let's do it.
            if (this._allowSignin) {
                const args = ["signin", "--raw", ...this._commonArgs];
                let password = null;
                if (this._ask) {
                    password = await this._ask(
                        `Enter the master key for your 1password "${this._account}" acount`
                    );
                    if (!password) {
                        throw new Error(
                            `No password provided for 1password "${this._account}" account`
                        );
                    }
                }

                this._sessionToken = (
                    await this._execSigninCommand(args, password)
                ).trim();
            } else {
                throw new Error(
                    `You are not signed into the 1password cli. See \`${this._opCommand} signin --help\` for details.`
                );
            }
        }
    }

    /**
     * A helper function used by `_ensureSignedIn` to do some specific things with spawn.
     */
    async _execSigninCommand(args, password = null) {
        return new Promise((resolve, reject) => {
            const fail = error => {
                reject(
                    Object.assign(
                        new Error(
                            `An error occurred attempting to sign in to 1password: ${error.message}`
                        ),
                        { cause: error }
                    )
                );
            };
            const proc = spawn(this._opCommand, args, {
                stdio: [password ? "pipe" : "inherit", "pipe", "pipe"]
            });
            const stdoutAsPromised = captureReadable(proc.stdout);
            const stderrAsPromised = captureReadable(proc.stderr);
            proc.on("error", fail);
            proc.on("exit", (code, signal) => {
                Promise.all([stdoutAsPromised, stderrAsPromised])
                    .then(([stdout, stderr]) => {
                        if (code === 0) {
                            resolve(stdout);
                        } else {
                            reject(
                                Object.assign(
                                    new Error(
                                        `Unexpected exit code ${code} while running 1password signin command: ${stderr}`
                                    ),
                                    {
                                        stdout,
                                        stderr
                                    }
                                )
                            );
                        }
                    })
                    .catch(fail);
            });
            if (password) {
                proc.stdin.write(Buffer.from(password, "utf-8"), error => {
                    if (error) {
                        fail(error);
                    } else {
                        proc.stdin.end();
                    }
                });
            }
        });
    }

    async getItem(uuid, { includeTrash = false } = false) {
        const args = ["get", "item"];
        if (includeTrash) {
            args.push("--include-trash");
        }
        const { stdout } = await this._runCommand(...args, uuid);
        return JSON.parse(stdout);
    }
}

async function captureReadable(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let done = false;
        const complete = () => {
            if (!done) {
                done = true;
                resolve(Buffer.concat(chunks).toString("utf8"));
            }
        };
        stream.on("data", chunk => {
            chunks.push(chunk);
        });
        stream.on("end", complete);
        stream.on("close", () => {
            if (!done) {
                reject(new Error("Stream was closed unexpectedly"));
            }
        });
        stream.on("error", reject);
    });
}

async function main() {
    try {
        const client = new OnePasswordClient({ allowSignin: true });
        const item = await client.getItem("google");
        console.log(item);
    } catch (error) {
        console.error(error);
    }
}

main();
