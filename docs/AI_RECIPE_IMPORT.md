# AI recipe import architecture

DinnerHub can support AI-assisted recipe creation from uploaded cooking videos and, where retrieval is permitted and technically possible, supported social-media URLs.

## Recommended workflow

1. User selects **Import recipe**.
2. User either uploads a video file or supplies a source URL.
3. DinnerHub stores the source temporarily in `/data/dinnerhub/imports`.
4. FFmpeg extracts the audio track and representative video frames.
5. Audio is transcribed using an AI transcription API.
6. Representative frames plus the transcript are sent to a multimodal model with a strict recipe schema.
7. The model returns a draft containing:
   - recipe name
   - description
   - categories and cuisine
   - prep/cook time estimates
   - servings
   - structured ingredients with quantities and units
   - structured cooking steps linked to ingredients
   - confidence/warning notes where information is uncertain
8. DinnerHub selects the strongest food frame as the proposed recipe image.
9. The user reviews and edits the draft.
10. Only after confirmation is a normal DinnerHub recipe created.

## Uploaded video

Uploaded files are the preferred and most reliable source because DinnerHub controls access to the media. A practical implementation should accept MP4, MOV and WebM with a configurable upload-size limit.

## Instagram and Facebook links

A pasted URL can be supported as a source, but retrieval is not guaranteed. Public/private status, authentication, expiring media URLs and platform restrictions can prevent automated access. The import screen should therefore offer both:

- **Paste social/video link**
- **Upload downloaded video**

If a URL cannot be retrieved, DinnerHub should explain the problem and immediately offer the upload path instead.

## AI provider

The initial provider can be OpenAI using separate transcription and multimodal analysis calls. The provider should be abstracted behind a small adapter so another API can be added later.

Recommended configuration fields:

- provider
- API key
- transcription model
- multimodal model
- maximum upload size
- frame sampling interval / maximum frame count
- whether source media is deleted immediately after the draft is created

API keys must never be sent to the browser. They should remain in Home Assistant app configuration and only be used by the DinnerHub backend.

## Review-first safety

AI-extracted quantities, temperatures and cooking times can be wrong or missing. Imported recipes should always be created as drafts and clearly mark uncertain values for review. DinnerHub should never silently publish an AI-generated recipe directly to the recipe library.

## Planned delivery

Version 0.9.0 introduces explicit ingredient-linked cooking steps, which are required for reliable AI imports. The full upload/link AI extraction workflow can then be implemented on top of that structured schema without changing the recipe data model again.
