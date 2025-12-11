# DeepGram SDK v5 Integration Notes

## Overview

MacroVox uses the DeepGram SDK for speech-to-text transcription. This document captures API changes and issues encountered during integration.

## Version Pinning

The `requirements.txt` pins `deepgram-sdk>=5.0.0,<6.0.0` to ensure API stability. The SDK underwent significant breaking changes between v3 and v5.

## Issues Encountered

### 1. Client Initialization

**Problem**: `BaseClient.__init__() takes 1 positional argument but 2 positional arguments were given`

**Cause**: SDK v5 requires `api_key` as a keyword argument, not positional.

```python
# Wrong (v3 style)
client = DeepgramClient(api_key)

# Correct (v5 style)
client = DeepgramClient(api_key=api_key)
```

### 2. API Path Changes

**Problem**: `'ListenClient' object has no attribute 'rest'`

**Cause**: The API path changed from `client.listen.rest.v("1")` to `client.listen.v1.media`.

```python
# Wrong (v3 style)
response = client.listen.rest.v("1").transcribe_file(payload, options)

# Correct (v5 style)
response = client.listen.v1.media.transcribe_file(...)
```

### 3. Method Signature Changes

**Problem**: `MediaClient.transcribe_file() takes 1 positional argument but 3 were given`

**Cause**: SDK v5 uses keyword-only arguments instead of dict-based options.

```python
# Wrong (v3 style)
payload = {"buffer": buffer_data}
options = {"model": "nova-2", "smart_format": True}
response = client.listen.v1.media.transcribe_file(payload, options)

# Correct (v5 style)
response = client.listen.v1.media.transcribe_file(
    request=buffer_data,
    model="nova-2",
    smart_format=True,
    punctuate=True,
    paragraphs=True,
)
```

### 4. Import Changes

**Problem**: `ImportError: cannot import name 'LiveTranscriptionEvents' from 'deepgram'`

**Cause**: Some classes were removed or renamed in v5. The simplified file transcription doesn't need these imports.

## Working Implementation

See `src/services/deepgram_service.py` for the working v5 implementation.

## API Reference

- DeepGram SDK v5 Docs: https://developers.deepgram.com/docs/python-sdk
- File transcription: `client.listen.v1.media.transcribe_file(request=bytes, **options)`
- Live streaming: `client.listen.v1.connect(...)` (not yet implemented)

## Future Considerations

- If upgrading to v6+, expect similar breaking changes
- Always test transcription after SDK updates
- Consider adding integration tests for the DeepGram service
