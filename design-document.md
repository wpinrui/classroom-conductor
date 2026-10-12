# Classroom Conductor plan

## Purpose

The Classroom Conductor is a reusable classroom orchestration website. Every student and the teacher each have a laptop. It works across any topic, subject, or level. It is for Ivan's personal use.

## Terms

- **Classroom Conductor**: the reusable website.
- **Applet**: the lesson-specific piece the teacher vibe codes during lesson preparation.
- **Contract**: the fixed interface every applet follows to work with the Classroom Conductor.
- **Library**: the teacher's collection of uploaded applets.
- **Session**: one live run of an applet with one class.
- **Phase**: one page of an applet.
- **Mode**: the classroom-wide state the teacher sets.
- **Handoff**: the transition from Demo into Independent, where students continue from the exact point the teacher stopped.
- **Engine**: the Claude Code process on the teacher's laptop. It answers chatbot requests and generates Pulses.
- **Pulse**: teacher-facing feedback generated from students' current state.

## Architecture

**Classroom Conductor.** A website opened in a browser.

**Backend.** One permanent Firebase project, brought by the teacher. All data lives in Realtime Database. Each session has its own path.

**Engine.** Runs on the teacher's laptop. It picks up requests from Realtime Database and writes replies back.

## Teacher

The teacher signs in. Applets are uploaded into the library. A session is started from the library and produces a join code.

The controls overlay the applet on the teacher's laptop. A keyboard shortcut shows or hides them. From the controls, the teacher can:

- switch modes
- trigger Handoff
- set group size, and form or rearrange groups
- override the chatbot rate limit
- request a Pulse for the whole class or one student
- blank the projected screen
- see live thumbnails of every student's screen (trial)

## Students

A student opens the Classroom Conductor, enters the join code, and types their name. If the applet provides a namelist, the name must be on it. The Classroom Conductor validates names, not the applet.

A student who refreshes or disconnects rejoins with their work intact.

Students form groups with a short code.

The chatbot is available when the applet supplies instructions, within rate limits.

## Modes

Modes are a fixed set provided by the Classroom Conductor. Every mode works with every applet.

- **Demo**: students watch the teacher use the applet live on their own laptops.
- **Spotlight**: the teacher picks a student, and everyone else views that student's screen, including on the teacher's laptop. The spotlighted student keeps working.
- **Anonymous Spotlight**: Spotlight without showing the student's name.
- **Gallery**: several students' screens shown side by side on everyone's laptop.
- **Independent**: students work in the applet themselves.
- **Group**: a group of students shares one applet state and works on it together.
- **Paced**: the teacher controls which phase everyone is on. Students work freely within it but cannot move ahead.
- **Freeze**: students see their own work but cannot change it.
- **Focus**: student screens go dark.
- **Reveal**: the teacher pushes one state onto every student's applet. That state is either the teacher's current state or one prepared in the applet.

## Contract

Every applet:

- is a single web page file, with assets embedded inline
- exposes its full state as data
- accepts a state handed to it
- declares its phases
- optionally supplies custom instructions for the chatbot, which switch the chatbot on
- optionally supplies the Pulse prompt, which switches the Pulse on
- optionally supplies a namelist
- optionally supplies prepared states for Reveal

## Chatbot

The Classroom Conductor provides a general chatbot. The applet's custom instructions shape it. The Engine answers every request. The rate limit is a Classroom Conductor default that the teacher can override.

## Pulse

The teacher requests a Pulse. It reads each student's current state at that moment. The Engine takes that raw data and the applet's Pulse prompt, then writes code that produces the Pulse. The same state always gives the same Pulse. Its form is freeform, decided by the prompt.
