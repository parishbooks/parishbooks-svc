import { spawnSync } from "node:child_process";
import inquirer, { type DistinctQuestion } from "inquirer";

type AssetType = "nest-application" | "nest-library" | "js-library";

const DEFAULT_TAGS = "scope:shared";
const DEFAULT_APP_TAGS = "scope:app";
const DEFAULT_LINTER = "eslint";
const DEFAULT_UNIT_TEST_RUNNER = "jest";
const DEFAULT_BUNDLER = "tsc";
const APP_NAME_PATTERN = /^parishbooks-[a-z0-9-]+$/;

interface Answers {
    asset: AssetType;
    name: string;
    service?: boolean;
    controller?: boolean;
    publishable?: boolean;
    e2e?: boolean;
}

const GENERATORS: Record<AssetType, string> = {
    "nest-application": "@nx/nest:application",
    "nest-library": "@nx/nest:library",
    "js-library": "@nx/js:library",
};

async function main() {
    const questions: DistinctQuestion<Answers>[] = [
        {
            type: "select",
            name: "asset",
            message: "Choose an asset to generate:",
            choices: [
                { name: "Nest.js application (microservice)", value: "nest-application" },
                { name: "Nest.js library", value: "nest-library" },
                { name: "JavaScript library", value: "js-library" },
            ],
        },
        {
            type: "input",
            name: "name",
            message: "Application name?",
            when: (a: Partial<Answers>) => a.asset === "nest-application",
            validate: (input: string) => {
                if (input.trim().length === 0) return "Name is required";
                if (!APP_NAME_PATTERN.test(input)) {
                    return "CLAUDE.md convention: new apps should be named parishbooks-<domain>-svc (e.g. parishbooks-crm-svc)";
                }
                return true;
            },
        },
        {
            type: "input",
            name: "name",
            message: "Library name?",
            when: (a: Partial<Answers>) => a.asset !== "nest-application",
            validate: (input: string) => (input.trim().length > 0 ? true : "Name is required"),
        },
        {
            type: "confirm",
            name: "e2e",
            message: "Include e2e tests?",
            default: true,
            when: (a: Partial<Answers>) => a.asset === "nest-application",
        },
        {
            type: "confirm",
            name: "service",
            message: "Include a service?",
            default: false,
            when: (a: Partial<Answers>) => a.asset === "nest-library",
        },
        {
            type: "confirm",
            name: "controller",
            message: "Include a controller?",
            default: false,
            when: (a: Partial<Answers>) => a.asset === "nest-library",
        },
        {
            type: "confirm",
            name: "publishable",
            message: "Publishable?",
            default: false,
            when: (a: Partial<Answers>) => a.asset === "js-library",
        },
    ];

    const answers = (await inquirer.prompt(questions)) as unknown as Answers;

    const isApp = answers.asset === "nest-application";
    const directory = isApp ? `apps/${answers.name}` : `packages/${answers.name}`;
    const importPath = `@parishbooks/${answers.name}`;

    const args = [
        "nx",
        "generate",
        GENERATORS[answers.asset],
        `--directory=${directory}`,
        `--name=${answers.name}`,
        `--linter=${DEFAULT_LINTER}`,
    ];

    if (isApp) {
        args.push(
            `--tags=${DEFAULT_APP_TAGS}`,
            `--unitTestRunner=${DEFAULT_UNIT_TEST_RUNNER}`,
            `--e2eTestRunner=${answers.e2e ? DEFAULT_UNIT_TEST_RUNNER : "none"}`,
            "--useProjectJson=false",
        );
    } else {
        args.push(
            `--unitTestRunner=${DEFAULT_UNIT_TEST_RUNNER}`,
            `--importPath=${importPath}`,
            `--tags=${DEFAULT_TAGS}`,
            "--buildable=true",
            "--useProjectJson=true",
        );
    }

    if (answers.asset === "nest-library") {
        args.push("--global=true", `--service=${answers.service}`, `--controller=${answers.controller}`);
    }

    if (answers.asset === "js-library") {
        args.push(`--bundler=${DEFAULT_BUNDLER}`, `--publishable=${answers.publishable}`);
    }

    args.push("--no-interactive");

    console.log(`\n> bun ${args.join(" ")}\n`);

    const result = spawnSync("bun", args, { stdio: "inherit" });

    if (result.status === 0 && isApp) {
        console.log(
            `\nGenerated ${directory}. This repo hand-wires a few things the generator doesn't: a Dockerfile and ` +
                "docker:build/prune targets (copy from apps/parishbooks-auth-svc), the @parishbooks/core dependency " +
                "(LoggerModule/HttpClientModule/Swagger) in app.module.ts and main.ts, and a tsconfig.app.json " +
                "project reference to packages/core/tsconfig.lib.json. See CLAUDE.md's Repo Map for the naming " +
                "convention and docs/architecture/microservices-http.md for the service map.\n",
        );
    }

    process.exit(result.status ?? 1);
}

void main();
