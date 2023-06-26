{
    "targets": [{
        "target_name": "backstage",
        "include_dirs": [ 
            "./inc/", 
            "./miniaudio"
        ],
        "sources": [ 
            "./src/stft.c", 
            "./src/xtime.c", 
            "./src/biquad.c", 
            "./src/threads.c",
            "./src/wavFile.c", 
            "./src/autosave.c", 
            "./src/backstage.c", 
            "./src/simulator.c", 
            "./src/heterodyne.c"
        ]
    }]
}
