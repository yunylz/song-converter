import inquirer from "inquirer";
import fs from "fs";

export enum Workflow {
  PROCESS_MAP = "Process Map (Full Automation - No Video)",
  CONVERT_VIDEO = "Convert Video (Mix -> DASH -> S3 Private)",
  EXIT = "Exit"
}

export interface CLIOptions {
  workflow: Workflow;
  input: string;
}

export default async (): Promise<CLIOptions> => {
  const answers = await inquirer.prompt([
    {
      type: "rawlist",
      name: "workflow",
      message: "What would you like to do?",
      choices: [Workflow.PROCESS_MAP, Workflow.CONVERT_VIDEO, Workflow.EXIT],
    },
    {
      type: "input",
      name: "input",
      message: "Path to input map folder:",
      when: (a) => a.workflow !== Workflow.EXIT,
      validate: (val) => fs.existsSync(val) || "Directory does not exist!",
    }
  ]);

  if (answers.workflow === Workflow.EXIT) {
    process.exit(0);
  }

  return {
    workflow: answers.workflow,
    input: answers.input
  };
};