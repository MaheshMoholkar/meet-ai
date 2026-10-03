# Local speech server (dev only)

Whisper speech-to-text and Kokoro text-to-speech on Apple Silicon (Metal) through [mlx-audio](https://github.com/Blaizzy/mlx-audio), with OpenAI-compatible `/v1/audio/transcriptions` and `/v1/audio/speech`. The voice agent talks to it through LiveKit's OpenAI plugins; in AWS, Transcribe and Polly take its place.

It runs natively because Docker on macOS has no GPU access. Python 3.12 only (Kokoro's phonemizer doesn't support 3.13 yet), so it's its own uv project.

```bash
make speech          # from the repo root: ./speech/run.sh, port 8000
make speech-warmup   # load both models (~1 GB on first download)
```

Models (set in `.env`): `mlx-community/whisper-large-v3-turbo-asr-4bit` and `mlx-community/Kokoro-82M-bf16` with voice `af_heart`. About 1.5 GB of RAM with both loaded. The agent requests `pcm` audio: `mp3` would need ffmpeg.
