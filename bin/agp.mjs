#!/usr/bin/env node
import { Command } from 'commander';
import express from 'express';
import chalk from 'chalk';
import { scanProject } from '../cli/agp-init.mjs';
import createAGPGateway from '../gateway/agp-bouncer.dist.mjs';

const program = new Command();

program
  .name('agp-system')
  .description('Universal Agent Gateway Protocol CLI')
  .version('1.0.0');

program
  .command('init')
  .description('Scan the codebase and generate the AGP Trust Bridge')
  .argument('[port]', 'The port your backend runs on', '5000')
  .action((port) => {
      scanProject(process.cwd(), port);
  });

program
  .command('serve')
  .description('Start the standalone AGP Gateway')
  .option('-p, --port <number>', 'Port for the Gateway', '3010')
  .action((options) => {
      const app = express();
      app.use('/api', createAGPGateway());
      app.listen(options.port, () => {
          console.log(chalk.green(`🚀 AGP Standalone Gateway live on http://localhost:${options.port}`));
      });
  });

program.parse(process.argv);
