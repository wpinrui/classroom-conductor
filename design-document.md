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
- **Mode**: whether students watch the teacher (Demo) or work in their own applet (Work).
- **Give**: every student continues from the state on screen, then works on it.
- **Reset**: every student's applet returns to the fresh start of its phase.
- **Engine**: the Claude Code process on the teacher's laptop. It answers chatbot requests and generates Pulses.
- **Pulse**: teacher-facing feedback generated from students' current state.

## Architecture

**Classroom Conductor.** A website opened in a browser.

**Backend.** One permanent Firebase project, brought by the teacher. All data lives in Realtime Database. Each session has its own path.

**Engine.** Runs on the teacher's laptop. It picks up requests from Realtime Database and writes replies back.

## Teacher

The teacher signs in. Applets are uploaded into the library. A session is started from the library and produces a join code.

The controls overlay the applet on the teacher's laptop. A keyboard shortcut shows or hides them. From the controls, the teacher can:

- switch modes, spotlight a student and darken student screens
- Give and Reset
- override the chatbot rate limit
- request a Pulse for the whole class or one student
- blank the projected screen
- see live thumbnails of every student's screen (trial)

## Students

A student opens the Classroom Conductor, enters the join code, and types their name. If the applet provides a namelist, the name must be on it. The Classroom Conductor validates names, not the applet.

A student who refreshes or disconnects rejoins with their work intact.

The chatbot is available when the applet supplies instructions, within rate limits.

## Modes

Every control works with every applet.

- **Demo**: students watch the teacher use the applet live on their own laptops.
- **Work**: students work in the applet themselves.
- **Spotlight**: everyone views one student's screen, including the projection, over either mode. The spotlighted student keeps working, and the teacher can work in it too.
- **Dark**: student screens go dark.
- **Give**: the state on screen, the teacher's or the spotlighted student's, replaces every student's state, then the class goes to Work.
- **Reset**: every student's applet returns to the fresh start of the phase it is on. The applet defines that start.

Revealing an answer or a prepared state is the applet's job. It draws it in the teacher's view, and the class sees it in Demo.

## Contract

Every applet:

- is a single web page file, with assets embedded inline
- exposes its full state as data
- accepts a state handed to it
- declares its phases
- optionally supplies custom instructions for the chatbot, which switch the chatbot on
- optionally supplies the Pulse prompt, which switches the Pulse on
- optionally supplies a namelist
- optionally rebuilds the fresh start of a phase, which switches Reset on

## Chatbot

The Classroom Conductor provides a general chatbot. The applet's custom instructions shape it. The Engine answers every request. The rate limit is a Classroom Conductor default that the teacher can override.

## Pulse

The teacher requests a Pulse. It reads each student's current state at that moment. The Engine takes that raw data and the applet's Pulse prompt, then writes code that produces the Pulse. The same state always gives the same Pulse. Its form is freeform, decided by the prompt.
