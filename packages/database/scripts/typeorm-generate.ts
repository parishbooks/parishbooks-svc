import { spawnSync } from 'node:child_process';
import inquirer from 'inquirer';

function toPascalCase(value: string): string {
    return value
        .trim()
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

async function main() {
    const { name } = await inquirer.prompt<{ name: string }>([
        {
            type: 'input',
            name: 'name',
            message: 'Migration name (e.g. Add Organization Profile):',
            validate: (value: string) => (toPascalCase(value).length > 0 ? true : 'Name must contain at least one letter or number'),
        },
    ]);

    const migrationName = toPascalCase(name);
    const result = spawnSync('typeorm-ts-node-commonjs', ['migration:generate', '-d', 'src/data-source.ts', `src/lib/migration/${migrationName}`], {
        stdio: 'inherit',
        env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.lib.json' },
    });

    process.exit(result.status ?? 1);
}

main();
