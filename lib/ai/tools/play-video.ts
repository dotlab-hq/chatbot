import { tool } from "ai";
import { z } from "zod";

function extractVideoMetadata(content: string): {
  videoUrl: string;
  videoTitle: string;
} {
  const urlMatch =
    content.match(
      /https?:\/\/[^\s"')\]]+\.(?:mp4|webm|mov|avi|ogg|mkv|flv|wmv|m3u8)[^\s"')\]]*/i
    ) ??
    content.match(
      /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/|player\.vimeo\.com\/video\/|dai\.ly\/|dailymotion\.com\/|twitch\.tv\/|mux\.com\/|streamable\.com\/|wistia\.com\/|loom\.com\/share\/|facebook\.com\/watch\/)[^\s"')\]]*/
    );
  const titleMatch = content.match(/\*\*Title:\*\*\s*(.+)/);
  const fallbackTitleMatch = content.match(/^#\s*(.+)/m);

  return {
    videoUrl: urlMatch?.[0] ?? "",
    videoTitle:
      titleMatch?.[1]?.trim() ?? fallbackTitleMatch?.[1]?.trim() ?? "Video",
  };
}

export const playVideo = tool({
  description:
    "Play a video inline in the chat. Provide a video URL from YouTube, Vimeo, direct file (.mp4, .webm, .mov), or other video platforms. The video will be displayed as an inline player in the chat.",
  inputSchema: z.object({
    url: z
      .string()
      .describe(
        "The video URL (YouTube, Vimeo, .mp4, .webm, .mov, .m3u8, etc.)"
      ),
    title: z.string().optional().describe("Optional title for the video"),
  }),
  execute: (input) => {
    const metadata = extractVideoMetadata(input.url);

    return {
      videoUrl: metadata.videoUrl || input.url,
      videoTitle: input.title || metadata.videoTitle || "Video Player",
    };
  },
});
