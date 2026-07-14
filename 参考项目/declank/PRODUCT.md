# Product

## Register

product

## Users

Declank is for technical and creative operators who need to clean up image files they have the rights and permissions to process. They may use the local CLI directly, but the primary product surface is a focused web UI for uploading a PNG, JPEG, or WebP image, choosing a removal mode, inspecting the result, and downloading the processed file.

Users are usually in a verification workflow, not a browsing workflow: they want to see the original, understand which operation will run, wait through potentially slow processing, and judge the output before keeping it.

## Product Purpose

Declank wraps the `remove-ai-watermarks` CLI with a small Node service and a web interface. It stages uploaded files, calls the external CLI with safe, whitelisted options, returns the output image, and preserves the CLI for direct automation.

Success means a user can quickly identify the current mode, upload a source image, process it with the default all-signal cleanup, compare the original context with the after result, and download the result with confidence. Failure states should be direct and actionable, especially when the upstream CLI or optional GPU dependencies are missing.

## Brand Personality

Declank should feel calm, precise, and utilitarian. The voice is plain, direct, and task-focused: it names what the app does without hype, "AI magic" claims, or decorative explanation.

The emotional goal is quiet technical confidence. The product should feel like a reliable bench tool: compact enough for repeated use, clear enough for careful inspection, and restrained enough that the image output remains the focus.

## Anti-references

Avoid flashy AI SaaS dashboards, neon glass effects, marketing hero pages, over-animated demos, crypto or game-like dark mode, and generic "transform your workflow" copy.

Avoid layouts that make the relationship between the original upload and the processed result hard to understand. Avoid hiding operational details behind vague labels when a direct option name or error message would help the user act.

## Design Principles

Task first: upload, mode choice, processing state, preview, and download should remain the strongest visual and interaction path.

Original and result stay legible: the source image belongs in the upload tile, and the processed output deserves the primary inspection area.

Expose power without clutter: advanced CLI options are available, but defaults should be safe and useful for first-run use.

Prefer familiar controls over novelty: use standard buttons, segmented choices, fields, and status indicators so the interface feels predictable.

Be honest about system state: slow processing, missing dependencies, unsupported files, and failed transforms should produce specific, recoverable messages.

## Accessibility & Inclusion

Target WCAG AA contrast, visible focus states, keyboard-operable upload and controls, and screen-reader-friendly labels for all primary actions.

The interface should respect reduced-motion preferences, never rely on color alone to communicate state, and prevent text from overflowing controls on desktop or mobile. File status, selected mode, processing state, errors, and download availability should remain understandable without needing to inspect the image visually.
