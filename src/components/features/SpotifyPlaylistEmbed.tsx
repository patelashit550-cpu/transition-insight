import { spotifyPlaylistEmbedSrc } from "@/lib/allowlisted-embed";

const SPOTIFY_ALLOW =
  "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

export function SpotifyPlaylistEmbed({
  playlistId,
  title = "Spotify playlist",
}: {
  playlistId: string;
  title?: string;
}) {
  const src = spotifyPlaylistEmbedSrc(playlistId);
  return (
    <figure className="p3-allowlisted-embed-frame p3-allowlisted-embed-frame--spotify">
      <iframe
        className="p3-allowlisted-embed p3-allowlisted-embed--spotify"
        src={src}
        title={title}
        width="100%"
        height={352}
        allow={SPOTIFY_ALLOW}
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </figure>
  );
}
