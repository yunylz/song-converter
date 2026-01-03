import inquirer from "inquirer";
import fs from "fs";
import { listDashMaps } from "./lib/s3"; // Import the list function

export enum Workflow {
  PROCESS_MAP = "Process Map (Full Automation - No Video)",
  CONVERT_VIDEO = "Convert Video (Mix -> DASH -> S3 Private)",
  CONVERT_VIDEO_DIRECT = "Convert Video (Direct -> DASH -> S3 Private)",
  CREATE_PREVIEW = "Create Video Preview (30s)", 
  CHECK_MISSING_DASH = "Check for Missing DASH Streams",
  CHECK_MISSING_PREVIEW = "Check for Missing Video Previews",
  EXIT = "Exit"
}

export enum PreviewMode {
  FROM_MAP = "From Map Folder (Auto-Sync)",
  FROM_DASH = "From S3 DASH (Download & Cut)",
  FROM_VIDEO = "From Manual Video File"
}

export interface CLIOptions {
  workflow: Workflow;
  input: string; 
  mapName?: string;
  previewMode?: PreviewMode; 
}

export default async (): Promise<CLIOptions> => {
  const answers = await inquirer.prompt([
    {
      type: "rawlist",
      name: "workflow",
      message: "What would you like to do?",
      choices: [
        Workflow.PROCESS_MAP, 
        Workflow.CONVERT_VIDEO, 
        Workflow.CONVERT_VIDEO_DIRECT, 
        Workflow.CREATE_PREVIEW, 
        Workflow.CHECK_MISSING_DASH, 
        Workflow.CHECK_MISSING_PREVIEW,
        Workflow.EXIT
      ],
    },
    // Sub-menu for Preview
    {
        type: "rawlist",
        name: "previewMode",
        message: "Select Preview Source:",
        choices: [PreviewMode.FROM_MAP, PreviewMode.FROM_DASH, PreviewMode.FROM_VIDEO],
        when: (a) => a.workflow === Workflow.CREATE_PREVIEW
    },
    // Map Input 
    {
      type: "input",
      name: "inputMap",
      message: "Path to input map folder:",
      when: (a) => 
        a.workflow === Workflow.PROCESS_MAP || 
        a.workflow === Workflow.CONVERT_VIDEO ||
        (a.workflow === Workflow.CREATE_PREVIEW && a.previewMode === PreviewMode.FROM_MAP),
      validate: (val) => fs.existsSync(val) || "Directory does not exist!",
    },
    // DASH Input (LIST from S3)
    {
      type: "rawlist", // or 'list' if you prefer scrolling
      name: "dashMapName",
      message: "Select Map (from S3 DASH):",
      choices: async () => {
          console.log(" Fetching DASH list from S3...");
          const maps = await listDashMaps();
          if (maps.length === 0) return ["No maps found"];
          return maps;
      },
      when: (a) => a.workflow === Workflow.CREATE_PREVIEW && a.previewMode === PreviewMode.FROM_DASH
    },
    // Direct Video Inputs
    {
      type: "input",
      name: "directMapName",
      message: "Enter the Map Name:",
      when: (a) => a.workflow === Workflow.CONVERT_VIDEO_DIRECT
    },
    {
      type: "input",
      name: "directVideoPath",
      message: "Path to the video file:",
      when: (a) => a.workflow === Workflow.CONVERT_VIDEO_DIRECT
    }
  ]);

  if (answers.workflow === Workflow.EXIT) {
    process.exit(0);
  }

  // Normalize inputs
  let finalInput = "";
  let finalMapName = answers.directMapName;

  if (answers.workflow === Workflow.CONVERT_VIDEO_DIRECT) {
      finalInput = answers.directVideoPath;
  } else if (answers.workflow === Workflow.CREATE_PREVIEW) {
      if (answers.previewMode === PreviewMode.FROM_MAP) finalInput = answers.inputMap;
      if (answers.previewMode === PreviewMode.FROM_DASH) finalMapName = answers.dashMapName;
      // FROM_VIDEO asks for its own inputs inside the controller
  } else if (![Workflow.CHECK_MISSING_DASH, Workflow.CHECK_MISSING_PREVIEW].includes(answers.workflow)) {
      finalInput = answers.inputMap;
  }

  return {
    workflow: answers.workflow,
    input: finalInput,
    mapName: finalMapName,
    previewMode: answers.previewMode
  };
};