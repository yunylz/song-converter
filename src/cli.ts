import { Command } from "commander";

export default (project: { version: string }) => {
  const program = new Command();

  program
    .name("sc")
    .description("SongConverter, made for JDBest.")
    .version(project.version)
    .option("-i, --input <path>", "Path to input map folder")
    .option("-o, --output <path>", "Path to output folder")
    .option("-p, --no-pictos", "Skip pictos conversion")
    .option("-m, --no-moves", "Skip moves conversion")
    .option("-a, --no-audio", "Skip audio conversion")
    .option("-M, --no-menuart", "Skip menuart conversion");

  program.parse(process.argv);

  const options = program.opts<{
    input: string; output: string,
    pictos: boolean, moves: boolean, audio: boolean, menuart: boolean
  }>();

  // Show help if no options are provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit(0); // exit after showing help
  }

  return options;
};
