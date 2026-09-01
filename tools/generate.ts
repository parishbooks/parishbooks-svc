import { spawnSync } from "node:child_process";
import inquirer, { type DistinctQuestion } from "inquirer";

type AssetType = "nest-library" | "js-library";

const DEFAULT_TAGS = "scope:shared";
const DEFAULT_LINTER = "eslint";
const DEFAULT_UNIT_TEST_RUNNER = "jest";
const DEFAULT_BUNDLER = "tsc";

interface Answers {
    asset: AssetType;
    name: string;
    service?: boolean;
    controller?: boolean;
    publishable?: boolean;
}

const GENERATORS: Record<AssetType, string> = {
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
                { name: "Nest.js library", value: "nest-library" },
                { name: "JavaScript library", value: "js-library" },
            ],
        },
        {
            type: "input",
            name: "name",
            message: "Library name?",
            validate: (input: string) => (input.trim().length > 0 ? true : "Name is required"),
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

    const directory = `packages/${answers.name}`;
    const importPath = `@parishbooks/${answers.name}`;

    const args = [
        "nx",
        "generate",
        GENERATORS[answers.asset],
        `--directory=${directory}`,
        `--name=${answers.name}`,
        `--linter=${DEFAULT_LINTER}`,
        `--unitTestRunner=${DEFAULT_UNIT_TEST_RUNNER}`,
        `--importPath=${importPath}`,
        `--tags=${DEFAULT_TAGS}`,
        "--buildable=true",
        "--useProjectJson=true",
    ];

    if (answers.asset === "nest-library") {
        args.push("--global=true", `--service=${answers.service}`, `--controller=${answers.controller}`);
    }

    if (answers.asset === "js-library") {
        args.push(`--bundler=${DEFAULT_BUNDLER}`, `--publishable=${answers.publishable}`);
    }

    args.push("--no-interactive");

    console.log(`\n> bun ${args.join(" ")}\n`);

    const result = spawnSync("bun", args, { stdio: "inherit" });

    process.exit(result.status ?? 1);
}

void main();
