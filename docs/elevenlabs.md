API : 3ffc1cc349a571c6249a85e1cef8d079b26531a5111d51e438aec6fdd6cb5508
doc url :https://elevenlabs.io/docs/eleven-api/quickstart

‘’‘’‘
voice changer 变声器.

---
title: Voice Changer quickstart
subtitle: Learn how to transform the voice of an audio file using the Voice Changer API.
---

<YoutubeEmbed id="QbBdQ_oUc3A" />

This guide will show you how to transform the voice of an audio file using the Voice Changer API.

<Tip>
  Use the [ElevenLabs voice-changer skill](https://github.com/elevenlabs/skills/tree/main/voice-changer) to transform voices in audio files from your AI coding assistant:

```bash
npx skills add elevenlabs/skills --skill voice-changer
```

</Tip>

## Using the Voice Changer API

<Steps>
    <Step title="Create an API key">
        [Create an API key in the dashboard here](https://elevenlabs.io/app/settings/api-keys), which you’ll use to securely [access the API](/docs/api-reference/authentication).
        
        Store the key as a managed secret and pass it to the SDKs either as a environment variable via an `.env` file, or directly in your app’s configuration depending on your preference.
        
        ```js title=".env"
        ELEVENLABS_API_KEY=<your_api_key_here>
        ```
        
    </Step>
    <Step title="Install the SDK">
        We'll also use the `dotenv` library to load our API key from an environment variable.
        
        <CodeBlocks>
            ```python
            pip install elevenlabs
            pip install python-dotenv
            ```
        
            ```typescript
            npm install @elevenlabs/elevenlabs-js
            npm install dotenv
            ```
        
        </CodeBlocks>
        

        <Note>
            To play the audio through your speakers, you may be prompted to install [MPV](https://mpv.io/)
            and/or [ffmpeg](https://ffmpeg.org/).
        </Note>
    </Step>
    <Step title="Make the API request">
        Create a new file named `example.py` or `example.mts`, depending on your language of choice and add the following code:

        <CodeBlocks>
        ```python maxLines=0
        # example.py
        import os
        from dotenv import load_dotenv
        from elevenlabs.client import ElevenLabs
        from elevenlabs.play import play
        import requests
        from io import BytesIO

        load_dotenv()

        elevenlabs = ElevenLabs(
          api_key=os.getenv("ELEVENLABS_API_KEY"),
        )
        voice_id = "JBFqnCBsd6RMkjVDRZzb"

        audio_url = (
            "https://storage.googleapis.com/eleven-public-cdn/audio/marketing/nicole.mp3"
        )
        response = requests.get(audio_url)
        audio_data = BytesIO(response.content)

        audio_stream = elevenlabs.speech_to_speech.convert(
            voice_id=voice_id,
            audio=audio_data,
            model_id="eleven_multilingual_sts_v2",
            output_format="mp3_44100_128",
        )

        play(audio_stream)
        ```

        ```typescript maxLines=0
        // example.mts
        import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
        import "dotenv/config";

        const elevenlabs = new ElevenLabsClient();
        const voiceId = "JBFqnCBsd6RMkjVDRZzb";

        const response = await fetch(
          "https://storage.googleapis.com/eleven-public-cdn/audio/marketing/nicole.mp3"
        );
        const audioBlob = new Blob([await response.arrayBuffer()], { type: "audio/mp3" });

        const audioStream = await elevenlabs.speechToSpeech.convert(voiceId, {
          audio: audioBlob,
          modelId: "eleven_multilingual_sts_v2",
          outputFormat: "mp3_44100_128",
        });

        await play(audioStream);
        ```
        </CodeBlocks>
    </Step>
    <Step title="Execute the code">
        <CodeBlocks>
            ```python
            python example.py
            ```

            ```typescript
            npx tsx example.mts
            ```
        </CodeBlocks>

        You should hear the transformed voice playing through your speakers.
    </Step>

</Steps>

## Next steps

<CardGroup cols={3}>
  <Card
    title="Browse voices"
    icon="file:assets/icons/voices.svg"
    href="https://elevenlabs.io/app/voice-library"
  >
    Explore 10,000+ voices to use as the target voice for transformation
  </Card>
  <Card
    title="Clone a voice"
    icon="file:assets/icons/ivc.svg"
    href="/docs/eleven-api/guides/how-to/voices/instant-voice-cloning"
  >
    Create a custom voice from a short audio recording to use as the target
  </Card>
  <Card
    title="API reference"
    icon="duotone book"
    href="/docs/api-reference/speech-to-speech/convert"
  >
    Explore all Voice Changer parameters and response formats
  </Card>
</CardGroup>


’‘’‘’‘


’‘’‘’‘’
sound effects 音效

---
title: Sound Effects quickstart
subtitle: Learn how to generate sound effects using the Sound Effects API.
---

This guide will show you how to generate sound effects using the Sound Effects API.

<Tip>
  Use the [ElevenLabs sound-effects skill](https://github.com/elevenlabs/skills/tree/main/sound-effects) to generate sound effects from your AI coding assistant:

```bash
npx skills add elevenlabs/skills --skill sound-effects
```

</Tip>

## Using the Sound Effects API

<Steps>
    <Step title="Create an API key">
        [Create an API key in the dashboard here](https://elevenlabs.io/app/settings/api-keys), which you’ll use to securely [access the API](/docs/api-reference/authentication).
        
        Store the key as a managed secret and pass it to the SDKs either as a environment variable via an `.env` file, or directly in your app’s configuration depending on your preference.
        
        ```js title=".env"
        ELEVENLABS_API_KEY=<your_api_key_here>
        ```
        
    </Step>
    <Step title="Install the SDK">
        We'll also use the `dotenv` library to load our API key from an environment variable.
        
        <CodeBlocks>
            ```python
            pip install elevenlabs
            pip install python-dotenv
            ```
        
            ```typescript
            npm install @elevenlabs/elevenlabs-js
            npm install dotenv
            ```
        
        </CodeBlocks>
        

        <Note>
            To play the audio through your speakers, you may be prompted to install [MPV](https://mpv.io/)
            and/or [ffmpeg](https://ffmpeg.org/).
        </Note>
    </Step>
    <Step title="Make the API request">
        Create a new file named `example.py` or `example.mts`, depending on your language of choice and add the following code:

        <CodeBlocks>
        ```python maxLines=0
        # example.py
        import os
        from dotenv import load_dotenv
        from elevenlabs.client import ElevenLabs
        from elevenlabs.play import play

        load_dotenv()

        elevenlabs = ElevenLabs(
          api_key=os.getenv("ELEVENLABS_API_KEY"),
        )
        audio = elevenlabs.text_to_sound_effects.convert(text="Cinematic Braam, Horror")

        play(audio)
        ```

        ```typescript
        // example.mts
        import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
        import "dotenv/config";

        const elevenlabs = new ElevenLabsClient();

        const audio = await elevenlabs.textToSoundEffects.convert({
          text: "Cinematic Braam, Horror",
        });

        await play(audio);
        ```
        </CodeBlocks>
    </Step>
    <Step title="Execute the code">
        <CodeBlocks>
            ```python
            python example.py
            ```

            ```typescript
            npx tsx example.mts
            ```
        </CodeBlocks>

        You should hear your generated sound effect playing through your speakers.
    </Step>

</Steps>

## Next steps

<CardGroup cols={3}>
  <Card
    title="Sound effects overview"
    icon="file:assets/icons/sfx.svg"
    href="/docs/overview/capabilities/sound-effects"
  >
    Learn about sound effect generation, supported formats, and use cases
  </Card>
  <Card title="Text to Speech" icon="file:assets/icons/tts.svg" href="/docs/eleven-api/quickstart">
    Generate spoken audio from text with the Text to Speech API
  </Card>
  <Card
    title="API reference"
    icon="duotone book"
    href="/docs/api-reference/text-to-sound-effects/convert"
  >
    Explore all Sound Effects parameters and response formats
  </Card>
</CardGroup>


‘’‘’‘’‘


'''''
创作音乐


---
title: Music quickstart
subtitle: Learn how to generate music with Eleven Music.
---

This guide will show you how to generate music with Eleven Music.

<Tip>
  Use the [ElevenLabs music skill](https://github.com/elevenlabs/skills/tree/main/music) to generate music tracks from your AI coding assistant:

```bash
npx skills add elevenlabs/skills --skill music
```

</Tip>

<Info>The Eleven Music API is only available to paid users.</Info>

## Using the Eleven Music API

<Steps>
    <Step title="Create an API key">
        [Create an API key in the dashboard here](https://elevenlabs.io/app/settings/api-keys), which you’ll use to securely [access the API](/docs/api-reference/authentication).
        
        Store the key as a managed secret and pass it to the SDKs either as a environment variable via an `.env` file, or directly in your app’s configuration depending on your preference.
        
        ```js title=".env"
        ELEVENLABS_API_KEY=<your_api_key_here>
        ```
        
    </Step>
    <Step title="Install the SDK">
        We'll also use the `dotenv` library to load our API key from an environment variable.
        
        <CodeBlocks>
            ```python
            pip install elevenlabs
            pip install python-dotenv
            ```
        
            ```typescript
            npm install @elevenlabs/elevenlabs-js
            npm install dotenv
            ```
        
        </CodeBlocks>
        
    </Step>
    <Step title="Make the API request">
        Create a new file named `example.py` or `example.mts`, depending on your language of choice and add the following code:

        <CodeBlocks>
        ```python
        # example.py
        from elevenlabs.client import ElevenLabs
        from elevenlabs.play import play
        import os
        from dotenv import load_dotenv
        load_dotenv()

        elevenlabs = ElevenLabs(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
        )

        track = elevenlabs.music.compose(
            prompt="Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
            music_length_ms=10000,
            model_id="music_v2",
        )

        # Save the track to a file
        with open("path/to/music.mp3", "wb") as f:
            for chunk in track:
                f.write(chunk)
        ```

        ```typescript
        // example.mts
        import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
        import { Readable } from "stream";
        import { createWriteStream } from "fs";
        import { pipeline } from "stream/promises";
        import "dotenv/config";

        const elevenlabs = new ElevenLabsClient();

        const track = await elevenlabs.music.compose({
          prompt: "Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
          musicLengthMs: 10000,
          modelId: "music_v2",
        });

        // Save the track to a file
        await pipeline(Readable.from(track), createWriteStream("path/to/music.mp3"));
        ```
        </CodeBlocks>
    </Step>
     <Step title="Execute the code">
        <CodeBlocks>
            ```python
            python example.py
            ```

            ```typescript
            npx tsx example.mts
            ```
        </CodeBlocks>

        You should hear the generated music playing.
    </Step>

</Steps>

## Composition plans

A composition plan is a JSON object that describes the music you want to generate in finer detail. Use text prompts for quick prototyping and composition plans when you need specific chunk structure, precise lyrics timing, or complex arrangements.

<Card
  title="Composition plans guide"
  icon="duotone music"
  href="/docs/eleven-api/guides/how-to/music/composition-plans"
>
  Learn how to structure songs with chunks, styles, and lyrics for precise control.
</Card>

### Generating a composition plan

A composition plan can be generated from a prompt by using the API.

<CodeBlocks>

    ```python
    from elevenlabs.client import ElevenLabs
    from elevenlabs.play import play
    import os
    from dotenv import load_dotenv
    load_dotenv()

    elevenlabs = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
    )

    composition_plan = elevenlabs.music.composition_plan.create(
        prompt="Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
        music_length_ms=10000,
        model_id="music_v2",
    )

    print(composition_plan)
    ```

    ```typescript
    import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
    import "dotenv/config";

    const elevenlabs = new ElevenLabsClient();

    const compositionPlan = await elevenlabs.music.compositionPlan.create({
      prompt: "Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
      musicLengthMs: 10000,
      modelId: "music_v2",
    });

    console.log(JSON.stringify(compositionPlan, null, 2));
    ```

</CodeBlocks>

The above will generate a composition plan similar to the following:

```json
{
  "chunks": [
    {
      "text": "[Intro]",
      "durationMs": 3000,
      "positiveStyles": [
        "electronic",
        "fast-paced",
        "rising synth arpeggio",
        "glitch fx",
        "filtered noise sweep",
        "soft punchy kick building tension",
        "high adrenaline"
      ],
      "negativeStyles": ["soft pads", "melodic vocals", "ambient textures"],
      "contextAdherence": "high"
    },
    {
      "text": "[Peak Drop]",
      "durationMs": 4000,
      "positiveStyles": [
        "full punchy drums",
        "distorted bass stab",
        "aggressive rhythmic hits",
        "rapid arpeggio sequences"
      ],
      "negativeStyles": ["smooth transitions", "clean bass", "slow buildup"],
      "contextAdherence": "high"
    },
    {
      "text": "[Final Burst]",
      "durationMs": 3000,
      "positiveStyles": [
        "glitch stutter",
        "energy burst vox chopped sample",
        "quick transitions",
        "snare rolls"
      ],
      "negativeStyles": ["long reverb tails", "fadeout", "gentle melodies"],
      "contextAdherence": "high"
    }
  ]
}
```

### Using a composition plan

A composition plan can be used to generate music by passing it to the `compose` method.

<CodeBlocks>
    ```python
    # You can pass in composition_plan or prompt, but not both.
    composition = elevenlabs.music.compose(
        composition_plan=composition_plan,
        model_id="music_v2",
    )

    play(composition)
    ```

    ```typescript
    // You can pass in compositionPlan or prompt, but not both.
    const composition = await elevenlabs.music.compose({
        compositionPlan,
        modelId: "music_v2",
    });

    await play(composition);
    ```

</CodeBlocks>

## Generating music with details

For each music generation a composition plan is created from the prompt. You can opt to retrieve this plan by using the detailed response endpoint.

<CodeBlocks>

    ```python
    track_details = elevenlabs.music.compose_detailed(
        prompt="Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
        music_length_ms=10000,
        model_id="music_v2",
    )

    print(track_details.json) # json contains composition_plan and song_metadata. The composition plan will include lyrics (if applicable)
    print(track_details.filename)
    # track_details.audio contains the audio bytes
    ```

    ```typescript
    const trackDetails = await elevenlabs.music.composeDetailed({
      prompt: 'Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 30–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.',
      musicLengthMs: 10000,
      modelId: "music_v2",
    });

    console.log(JSON.stringify(trackDetails.json, null, 2)); // json contains composition_plan and song_metadata. The composition plan will include lyrics (if applicable)
    console.log(trackDetails.filename);
    // trackDetails.audio contains the audio bytes
    ```

</CodeBlocks>

## Copyrighted material

Attempting to generate music or a composition plan that contains copyrighted material will result in an error. This includes mentioning a band or musician by name or using copyrighted lyrics.

### Prompts with copyrighted material

In these cases, the API will return a `bad_prompt` error that contains a suggestion of what prompt you could use instead.

<CodeBlocks>
    ```python
    try:
        # This will result in a bad_prompt error
        track = elevenlabs.music.compose(
            prompt="A song that sounds like 'Bohemian Rhapsody'",
            music_length_ms=10000,
            model_id="music_v2",
        )
      except Exception as e:
          if e.body['detail']['status'] == 'bad_prompt':
              prompt_suggestion = e.body['detail']['data']['prompt_suggestion']
              print(prompt_suggestion) # Prints: An epic rock ballad with dramatic tempo changes, operatic harmonies, and a narrative structure that blends melancholy with bursts of theatrical intensity.

              # Use the prompt suggestion to generate the track instead
    ```

    ```typescript
    try {
      // This will result in a bad_prompt error
      const track = await elevenlabs.music.compose({
        prompt: "A song that sounds like 'Bohemian Rhapsody'",
        musicLengthMs: 10000,
        modelId: "music_v2",
      });
    } catch (error) {
      if (error.body.detail.status === 'bad_prompt') {
        const promptSuggestion = error.body.detail.data.prompt_suggestion;
        console.log(promptSuggestion); // Logs: An epic rock ballad with dramatic tempo changes, operatic harmonies, and a narrative structure that blends melancholy with bursts of theatrical intensity.

        // Use the prompt suggestion to generate the track instead
      }
    }
    ```

</CodeBlocks>

### Composition plans with copyrighted material

If styles using copyrighted material are used when generating a composition plan, a `bad_composition_plan` error will be returned. Similar to music prompts, a suggested composition plan `composition_plan_suggestion` will be returned within the error.

<Warning>
  In the case of a composition plan or prompt that contains harmful material, no suggested prompt
  will be returned.
</Warning>

## Next steps

<CardGroup cols={3}>
  <Card
    title="Stream music"
    icon="file:assets/icons/music.svg"
    href="/docs/eleven-api/guides/how-to/music/streaming"
  >
    Stream generated music in real time rather than waiting for the full file
  </Card>
  <Card
    title="Music inpainting"
    icon="file:assets/icons/music.svg"
    href="/docs/eleven-api/guides/how-to/music/inpainting"
  >
    Modify or extend specific sections of an existing music track
  </Card>
  <Card title="API reference" icon="duotone book" href="/docs/api-reference/music/compose">
    Explore all Music API parameters and response formats
  </Card>
</CardGroup>


'''''