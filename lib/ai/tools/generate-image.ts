import { openai } from "@ai-sdk/openai";
import { generateImage, NoImageGeneratedError, tool } from "ai";
import { z } from "zod";
import { uploadToS3 } from "@/lib/s3";

export type GeneratedImage = {
  url: string;
  mediaType: string;
};

const IMAGE_MODEL = openai.image("gpt-image-1");

// gpt-image-1 supports a few fixed sizes; keep to the documented set so
// the SDK doesn't reject the request.
const SUPPORTED_SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;

function normalizeSize(
  size: string | undefined
): (typeof SUPPORTED_SIZES)[number] {
  if (size && (SUPPORTED_SIZES as readonly string[]).includes(size)) {
    return size as (typeof SUPPORTED_SIZES)[number];
  }
  return "1024x1024";
}

export const generateImageTool = tool({
  description:
    "Generate images from a text prompt using an image model. Supports generating multiple images at once (in parallel) — set count to e.g. 5 to get 5 images rendered as a collage. Use this whenever the user asks to draw, create, generate, or make an image/picture/illustration/logo/photo.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe("Detailed description of the image to generate"),
    count: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .describe(
        "Number of images to generate in parallel (1-4). Default 1. Use higher counts when the user asks for several/variations/a collage."
      ),
    size: z
      .enum(["1024x1024", "1536x1024", "1024x1536"])
      .optional()
      .describe("Image size. Default 1024x1024 (square)."),
  }),
  execute: async ({ prompt, count = 1, size }) => {
    try {
      const { images } = await generateImage({
        model: IMAGE_MODEL,
        prompt,
        // generateImage auto-batches parallel calls to produce `n` images.
        n: count,
        size: normalizeSize(size),
        // Don't let a single slow image stall the whole batch.
        abortSignal: AbortSignal.timeout(120_000),
      });

      const generated: GeneratedImage[] = await Promise.all(
        images.map(async (image, i) => {
          const mediaType = image.mediaType ?? "image/png";
          const uint8 = image.uint8Array;

          // Upload to S3 so the message stores a URL, not a giant base64 blob.
          // Fall back to a data URL if S3 isn't configured.
          let url: string;
          try {
            const { s3Url } = await uploadToS3({
              userId: "system",
              chatId: "image-gen",
              filename: `gen-${Date.now()}-${i}.png`,
              mediaType,
              data: uint8,
            });
            url = s3Url;
          } catch {
            url = `data:${mediaType};base64,${image.base64 ?? ""}`;
          }

          return { url, mediaType };
        })
      );

      return {
        prompt,
        count: generated.length,
        images: generated,
      };
    } catch (error) {
      if (NoImageGeneratedError.isInstance(error)) {
        throw new Error(
          `Image generation failed: ${error.cause ?? "no image returned"}`
        );
      }
      throw error;
    }
  },
});
