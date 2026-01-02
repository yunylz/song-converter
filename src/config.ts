/**
 * Default configuration for the SongConverter.
 */
export default {
    PICTOS_SIZE: [512, 512],
    COACH_SIZE : [1024, 1024],
    ALBUMCOACH_SIZE : [1024, 1024],
    ALBUMBKG_SIZE : [512, 512],
    COVER_GENERIC_SIZE : [512, 512],
    BANNER_BKG_SIZE: [1024, 512],
    MAP_BKG_SIZE: [2048, 1024],
    VIDEOSCOACH_RESOLUTION: [1920, 1080],
    VIDEOSCOACH_FPS: 25,
    MUTE_VIDEOSCOACH: true,
    MINIFY_JSON: true,
    S3: {
        ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
        SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
        BUCKET: process.env.S3_BUCKET,
        ENDPOINT: process.env.S3_ENDPOINT,
        REGION: "eu-central-1"
    }
};