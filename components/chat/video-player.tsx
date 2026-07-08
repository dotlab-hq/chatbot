"use client";

import {
  Maximize2Icon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function VideoPlayer({
  videoUrl,
  title,
  width = 640,
  height = 360,
  className,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch((err) => {
          console.error("Error playing video:", err);
          setError("Failed to play video");
        });
        setIsPlaying(true);
      }
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.volume = value[0];
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
    if (isMuted) {
      setVolume(0.7);
      videoRef.current.volume = 0.7;
    } else {
      setVolume(0);
      videoRef.current.volume = 0;
    }
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.currentTime += seconds;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("durationchange", updateDuration);
    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("durationchange", updateDuration);
      video.addEventListener("loadstart", handleLoadStart);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const getVideoSource = () => {
    if (!videoUrl) {
      return null;
    }

    if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
      const videoId = videoUrl.includes("v=")
        ? videoUrl.split("v=")[1].split("&")[0]
        : videoUrl.split("/").pop();
      return `https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}`;
    }
    if (videoUrl.includes("vimeo.com")) {
      const videoId = videoUrl.split("/").pop();
      return `https://player.vimeo.com/video/${videoId}?autoplay=${isPlaying ? 1 : 0}&muted=${isMuted ? 1 : 0}`;
    }
    if (videoUrl.includes("mux.com")) {
      return `https://stream.mux.com/${videoUrl.split("/")[4]}.m3u8`;
    }
    return videoUrl;
  };

  const isThirdPartyVideo =
    videoUrl.includes("youtube.com") ||
    videoUrl.includes("youtu.be") ||
    videoUrl.includes("vimeo.com") ||
    videoUrl.includes("mux.com");

  if (isThirdPartyVideo) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border bg-background",
          className
        )}
        ref={containerRef}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <iframe
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0"
          frameBorder="0"
          height="100%"
          src={getVideoSource()}
          title={title || "Video Player"}
          width="100%"
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white p-4">
            <div className="text-center">
              <p className="font-semibold mb-2">Error: {error}</p>
              <p className="text-sm">
                Please check the video URL or try again later.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border bg-background",
        className
      )}
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <video
        className="w-full h-full object-cover"
        height="100%"
        muted={isMuted}
        onClick={handleVideoClick}
        poster="https://picsum.photos/seed/video-poster/640/360.jpg"
        ref={videoRef}
        src={getVideoSource()}
        volume={volume}
        width="100%"
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white p-4">
          <div className="text-center">
            <p className="font-semibold mb-2">Error: {error}</p>
            <p className="text-sm">
              Please check the video URL or try again later.
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button
              className="text-white hover:bg-white/20"
              onClick={() => skipTime(-10)}
              size="sm"
              variant="ghost"
            >
              <SkipBackIcon size={16} />
            </Button>
            <Button
              className="text-white hover:bg-white/20"
              onClick={handleVideoClick}
              size="sm"
              variant="ghost"
            >
              {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </Button>
            <Button
              className="text-white hover:bg-white/20"
              onClick={() => skipTime(10)}
              size="sm"
              variant="ghost"
            >
              <SkipForwardIcon size={16} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="text-white hover:bg-white/20"
              onClick={toggleMute}
              size="sm"
              variant="ghost"
            >
              {isMuted ? <VolumeXIcon size={16} /> : <Volume2Icon size={16} />}
            </Button>
            <div className="w-20">
              <Slider
                className="w-full"
                max={1}
                onValueChange={handleVolumeChange}
                step={0.1}
                value={[isMuted ? 0 : volume]}
              />
            </div>
            <Button
              className="text-white hover:bg-white/20"
              onClick={toggleFullscreen}
              size="sm"
              variant="ghost"
            >
              {isFullscreen ? (
                <MinimizeIcon size={16} />
              ) : (
                <Maximize2Icon size={16} />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/80 w-10">
            {formatTime(currentTime)}
          </span>
          <Slider
            className="flex-1"
            max={duration || 100}
            onValueChange={handleSeek}
            step={0.1}
            value={[currentTime]}
          />
          <span className="text-xs text-white/80 w-10">
            {Number.isFinite(duration) ? formatTime(duration) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
