import React, { useRef, useEffect } from 'react';
import fluidPlayer from 'fluid-player';
// 🟢 Import the player's CSS so it looks beautiful
import 'fluid-player/src/css/fluidplayer.css'; 

const ExoPlayer = ({ videoUrl, posterUrl }) => {
    const videoRef = useRef(null);
    const playerInstance = useRef(null);

    useEffect(() => {
        // Initialize the player once the video element is mounted
        if (videoRef.current && !playerInstance.current) {
            playerInstance.current = fluidPlayer(videoRef.current, {
                layoutControls: {
                    fillToContainer: true, // Makes it responsive
                    posterImage: posterUrl || '', // Shows your thumbnail before play
                    autoPlay: false, // Don't auto-play, let the user click
                    playButtonShowing: true,
                },
                vastOptions: {
                    allowVPAID: true, // Required for some ExoClick high-paying ads
                    adList: [
                        {
                            roll: 'preRoll', // 🟢 Plays BEFORE your main video
                            vastTag: 'https://s.magsrv.com/v1/vast.php?idzone=5880122', // YOUR EXOCLICK TAG
                            adText: 'Ad will close in [unplayedSeconds] seconds', // Skip text
                            adTextPosition: 'top right'
                        }
                    ]
                }
            });
        }

        // Cleanup: destroy the player when the component unmounts
        return () => {
            if (playerInstance.current) {
                playerInstance.current.destroy();
                playerInstance.current = null;
            }
        };
    }, [videoUrl]); // Re-run if the videoUrl changes

    return (
        <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <video ref={videoRef}>
                {/* 🟢 Fluid Player natively supports Cloudflare's .m3u8 HLS streams! */}
                <source src={videoUrl} type="application/x-mpegURL" />
            </video>
        </div>
    );
};

export default ExoPlayer;