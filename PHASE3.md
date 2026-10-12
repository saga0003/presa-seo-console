# Phase 3 — NEET Resource Library

Status: **Engineering complete / corpus rollout active**
Updated: 12 Oct 2026

## What is live

Presa SEO Console v0.6.0 now includes a persistent NEET resource-library engine backed by private Vercel Blob storage.

Tools added:
- `neet_resource_inventory`
- `upsert_neet_resource`
- `bulk_upsert_neet_resources`
- `upsert_neet_question`
- `neet_question_search`
- `neet_question_qa`
- `neet_page_blueprint`
- `neet_resource_gap_report`
- `neet_library_manifest`

The library seeds a canonical architecture for:
- one NEET PYQ hub
- year pages from 2014–2026
- Physics, Chemistry, Botany and Zoology collection pages
- chapter collections
- high-quality standalone question pages where justified

## Quality/indexation policy

Do not mass-index thin AI pages.

A question is index-ready only when it has:
- question stem
- four options
- correct answer
- worked solution
- source reference
- exam year
- subject
- chapter
- rights/source declaration

The QA tool detects missing fields and duplicate stems.

Question-level pages should only be indexed if they are standalone-useful. Otherwise, questions remain inside richer year/subject/chapter collection pages.

## Rights/source policy

- Do not copy competitor explanations.
- Link/attribute lawful source material where appropriate.
- Use official NTA/NEET materials as the primary reference for official exam updates/keys.
- St. Mary’s worked solutions, analysis and learning annotations should be original.

## Public website foundation created

- `https://smis.edu.in/neet/` — NEET resource centre
- `https://smis.edu.in/neet/previous-year-question-papers/` — canonical PYQ hub

The hub links to existing St. Mary’s NEET resources such as the 2026 question-paper article, model papers and simulation test while older-year resources are held back from standalone indexation until verified content is ready.

## Competitor-derived architecture

Current leaders such as PW and Vedantu use a year-wise + subject-wise PYQ structure. PW currently exposes 2014–2026 and explicitly promotes year-wise, subject-wise and chapter-wise practice; Vedantu similarly exposes 2015–2026 with subject breakdowns. Presa adopts the useful information architecture without copying competitor text or solutions.

## Remaining corpus work

The software/information architecture is complete. The historical question corpus itself must be populated from verified sources and reviewed. That is intentionally not marked as complete simply by creating placeholder pages; doing so would create thin content and reduce site quality.
