import axios from "axios";
import logger from "./logger";
import crypto from "crypto";
import { Difficulty, SweatDifficulty } from "../types/godot";

class Strapi {
    private getStrapi() {
        const token = process.env.STRAPI_TOKEN;
        if (!token) throw new Error("STRAPI_TOKEN is not set");
        return { url: "https://best-strapi.ryuatelier.org", token };
    }

    private get headers() {
        const { token } = this.getStrapi();
        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    }

    /**
     * Map numeric enums to the specific strings Strapi expects
     */
    private formatEnum(val: any, type: "difficulty" | "sweat"): string {
        if (val === undefined || val === null) return type === "difficulty" ? "MEDIUM" : "MODERATE";

        let rawValue = "";
        if (typeof val === 'number') {
            // Map numbers based on the Enum definitions in godot.ts
            if (type === "difficulty") {
                rawValue = Difficulty[val] || "Medium";
            } else {
                rawValue = SweatDifficulty[val] || "Moderate";
            }
        } else if (typeof val === 'string') {
            rawValue = val.includes('.') ? val.split('.')[1] : val;
        }

        const upper = rawValue.toUpperCase();

        // Final Strapi Validation Mapping
        if (type === "difficulty") {
            const allowed = ["EASY", "MEDIUM", "HARD", "EXTREME"];
            return allowed.includes(upper) ? upper : "MEDIUM";
        } else {
            // JD Sweat often uses Low/Medium/High, but Strapi wants LOW/MODERATE/HIGH
            if (upper === "MEDIUM") return "MODERATE"; 
            const allowed = ["LOW", "MODERATE", "HIGH"];
            return allowed.includes(upper) ? upper : "MODERATE";
        }
    }

    async syncSong(songData: any, version: number) {
        const { url } = this.getStrapi();

        try {
            logger.info(`Syncing ${songData.mapName} to Strapi...`);

            // 1. Check if song exists
            const search = await axios.get(
                `${url}/api/songs?filters[mapName][$eq]=${encodeURIComponent(songData.mapName)}`,
                { headers: this.headers }
            );
            const existingSong = search.data?.data?.[0];

            // 2. Resolve Game Relation
            const gameSearch = await axios.get(
                `${url}/api/games?filters[version][$eq]=${encodeURIComponent(songData.originalJDVersion)}`,
                { headers: this.headers }
            );
            const gameDocId = gameSearch.data?.data?.[0]?.documentId ?? null;

            // 3. Prepare Data
            const dataPayload: any = {
                mapName: songData.mapName,
                title: songData.title,
                artist: songData.artist,
                coachCount: songData.numCoach,
                difficulty: this.formatEnum(songData.difficulty, "difficulty"),
                sweatDifficulty: this.formatEnum(songData.sweatDifficulty, "sweat"),
                version: version.toString(),
                credits: songData.credits || "Converted via SongConverter",
                mapLength: "0",
                mapHash: songData.mapHash || crypto.randomUUID()
            };

            if (gameDocId) {
                dataPayload.game = {
                    connect: [gameDocId]
                };
            }

            const payload = { data: dataPayload };

            if (existingSong) {
                const docId = existingSong.documentId;
                await axios.put(`${url}/api/songs/${docId}`, payload, { headers: this.headers });
                logger.success(`Updated ${songData.mapName} on Strapi.`);
            } else {
                await axios.post(`${url}/api/songs`, payload, { headers: this.headers });
                logger.success(`Created ${songData.mapName} on Strapi.`);
            }
        } catch (error: any) {
            const strapiError = error.response?.data?.error?.details?.errors?.[0]?.message 
                               || error.response?.data?.error?.message 
                               || error.message;
            logger.error(`Strapi Sync Error: ${strapiError}`);
        }
    }
}

export default new Strapi();