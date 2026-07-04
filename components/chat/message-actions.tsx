import equal from "fast-deep-equal";
import { memo, useCallback, useRef, useState } from "react";
import { Volume2Icon } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import {
  MessageAction as Action,
  MessageActions as Actions,
} from "@/components/ai-elements/message";
import {
  CopyIcon,
  PencilEditIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "@/components/chat/icons";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

let currentAudio: HTMLAudioElement | null = null;
let currentMessageId: string | null = null;

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  onEdit,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  onEdit?: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  const handleToggleSpeech = useCallback(async () => {
    const id = message.id;

    // If this message is playing, stop it
    if (playingId === id && currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      currentMessageId = null;
      setPlayingId(null);
      return;
    }

    // Stop any previously playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
      currentMessageId = null;
      setPlayingId(null);
    }

    // Check cache first
    const cachedUrl = audioCacheRef.current.get(id);
    if (cachedUrl) {
      const audio = new Audio(cachedUrl);
      currentAudio = audio;
      currentMessageId = id;
      setPlayingId(id);
      audio.onended = () => {
        setPlayingId(null);
        currentAudio = null;
        currentMessageId = null;
      };
      audio.play();
      return;
    }

    // Generate speech via API
    setLoadingId(id);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/speech`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: id, chatId, text: textFromParts }),
        }
      );

      if (!res.ok) throw new Error("Speech generation failed");
      const { url } = await res.json();

      audioCacheRef.current.set(id, url);

      const audio = new Audio(url);
      currentAudio = audio;
      currentMessageId = id;
      setPlayingId(id);
      setLoadingId(null);

      audio.onended = () => {
        setPlayingId(null);
        currentAudio = null;
        currentMessageId = null;
      };

      audio.play();
    } catch {
      setLoadingId(null);
      toast.error("Failed to generate speech");
    }
  }, [message.id, chatId, textFromParts, playingId]);

  if (isLoading) {
    return null;
  }

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
        <div className="flex items-center gap-0.5">
          {onEdit && (
            <Action
              className="size-7 text-muted-foreground/50 hover:text-foreground"
              data-testid="message-edit-button"
              onClick={onEdit}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action
            className="size-7 text-muted-foreground/50 hover:text-foreground"
            onClick={handleCopy}
            tooltip="Copy"
          >
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5 opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        onClick={handleCopy}
        tooltip="Copy"
      >
        <CopyIcon />
      </Action>

      <Action
        className={playingId === message.id ? "size-7 rounded-md bg-foreground text-background" : "text-muted-foreground/50 hover:text-foreground"}
        disabled={loadingId === message.id}
        onClick={handleToggleSpeech}
        tooltip={playingId === message.id ? "Stop" : "Read Aloud"}
      >
        {playingId === message.id ? (
          <span className="block size-2 rounded-sm bg-background" />
        ) : loadingId === message.id ? (
          <span className="block size-3.5 animate-pulse rounded-full bg-current" />
        ) : (
          <Volume2Icon className="size-4" />
        )}
      </Action>

      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          const upvote = fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
            {
              method: "PATCH",
              body: JSON.stringify({
                chatId,
                messageId: message.id,
                type: "up",
              }),
            }
          );

          toast.promise(upvote, {
            loading: "Upvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: true,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Upvoted Response!";
            },
            error: "Failed to upvote response.",
          });
        }}
        tooltip="Upvote Response"
      >
        <ThumbUpIcon />
      </Action>

      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          const downvote = fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
            {
              method: "PATCH",
              body: JSON.stringify({
                chatId,
                messageId: message.id,
                type: "down",
              }),
            }
          );

          toast.promise(downvote, {
            loading: "Downvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: false,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Downvoted Response!";
            },
            error: "Failed to downvote response.",
          });
        }}
        tooltip="Downvote Response"
      >
        <ThumbDownIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }

    return true;
  }
);
