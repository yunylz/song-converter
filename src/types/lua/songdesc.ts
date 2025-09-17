export interface SongDescTemplate {
  params: {
    NAME: string | null;
    Actor_Template: {
      TAGS: Array<{
        VAL: string | null;
        [key: string]: unknown;
      }>;
      COMPONENTS: Array<{
        NAME: string | null;
        JD_SongDescTemplate: {
          MapName: string | null;
          JDVersion: number;
          RelatedAlbums: Record<string, unknown>;
          Artist: string | null;
          Title: string | null;
          NumCoach: string | null;
          Difficulty: string | null;
          SweatDifficulty: string | null;
          GameModes: Array<{
            NAME: string | null;
            GameModeDesc: {
              mode: string | null;
              flags: string | null;
              status: string | null;
              [key: string]: unknown;
            };
            [key: string]: unknown;
          }>;
          DefaultColors: Array<{
            KEY: string | null;
            VAL: string | null;
            [key: string]: unknown;
          }>;
          AudioPreviewFadeTime: number;
          AudioPreviews: Array<{
            NAME: string | null;
            AudioPreview: {
              name: string | null;
              startbeat: number;
              endbeat: number;
              [key: string]: unknown;
            };
            [key: string]: unknown;
          }>;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}