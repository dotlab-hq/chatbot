"use client";

import { PauseIcon, PlayIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./video-inline.css";

interface VideoInlineProps {
  videoUrl: string;
  title?: string;
}

export function VideoInline({ videoUrl, title }: VideoInlineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setError("Failed to load video");
      setIsLoading(false);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
    };
    // We intentionally only re-attach when the ref element changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleVolumeChange = (vol: number[]) => {
    const newVolume = vol[0];
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getVideoEmbedUrl = (url: string): string => {
    // Handle YouTube
    const youtubeMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/
    );
    if (youtubeMatch?.[1]) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1`;
    }

    // Handle Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch?.[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }

    // For direct video files or other URLs, try to use it directly
    return url;
  };

  if (!isClient) {
    return (
      <div className="w-full max-w-2xl mx-auto rounded-2xl border border-border/50 bg-muted/30 p-4">
        <div className="mb-2 text-muted-foreground text-xs">Video Player</div>
        <div className="text-muted-foreground text-sm">Loading video...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto rounded-2xl border border-border/50 bg-muted/30 p-4">
        <div className="mb-2 text-muted-foreground text-xs">Video Player</div>
        <div className="text-destructive text-sm">{error}</div>
        <div className="text-muted-foreground text-xs mt-2">
          URL: {videoUrl}
        </div>
      </div>
    );
  }

  const embedUrl = getVideoEmbedUrl(videoUrl);
  const isVideoFile =
    !embedUrl.includes("youtube.com") && !embedUrl.includes("vimeo.com");

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-border/50 bg-black overflow-hidden">
      <div className="relative">
        <div className="aspect-video bg-black">
          {isVideoFile && isClient ? (
            <video
              className="w-full h-full object-contain"
              controls={false}
              onClick={handlePlayPause}
              ref={videoRef}
              src={videoUrl}
            >
              <track kind="captions" label="No captions available" src="" />
            </video>
          ) : (
            <iframe
              allow="autoplay; fullscreen"
              allowFullScreen
              className="w-full h-full"
              src={embedUrl}
              title={title ?? "Video player"}
            />
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white">Loading video...</div>
            </div>
          )}

          <button
            aria-label={isPlaying ? "Pause video" : "Play video"}
            className="absolute bottom-4 left-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 text-white"
            onClick={handlePlayPause}
            type="button"
          >
            {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
        </div>

        {duration > 0 && (
          <div className="p-4 bg-black">
            <div className="flex items-center justify-between mb-2">
              <div className="text-white text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <div className="text-white text-xs opacity-70">
                {title || "Video"}
              </div>
            </div>

            <input
              aria-label="Video seek bar"
              className="w-full h-2 bg-white/20 rounded-full cursor-pointer accent-white"
              max={duration || 0}
              min={0}
              onChange={(e) => {
                const newTime = Number.parseFloat(e.target.value);
                if (videoRef.current) {
                  videoRef.current.currentTime = newTime;
                }
              }}
              step={0.1}
              type="range"
              value={currentTime}
            />

            <div className="flex items-center justify-between mt-3">
              <button
                aria-label={isMuted ? "Unmute" : "Mute"}
                className="text-white hover:text-white/80"
                onClick={toggleMute}
                type="button"
              >
                {isMuted ? (
                  <VolumeXIcon size={16} />
                ) : (
                  <Volume2Icon size={16} />
                )}
              </button>

              <div className="flex items-center gap-2">
                <input
                  aria-label="Volume"
                  className="w-20 h-1 bg-white/20 rounded-full cursor-pointer"
                  max="1"
                  min="0"
                  onChange={(e) =>
                    handleVolumeChange([Number.parseFloat(e.target.value)])
                  }
                  step="0.1"
                  type="range"
                  value={volume}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
