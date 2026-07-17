import { openai } from "@ai-sdk/openai";
import { generateImage } from "ai";

const { image } = await generateImage({
  model: openai.image("gpt-image-1"),
  prompt: "Santa Claus driving a Cadillac",
});
