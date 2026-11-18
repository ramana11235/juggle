# Juggle

A chat app for two people where each deep topic they want to go into has a conversation of its own, which either of them comes back to when they are ready. Their everyday chat stays in WhatsApp.

## Language

**Person**:
Someone who uses Juggle, known to it by the email they sign in with and shown to others by the name they give themselves, which they give before anything else and can change.
_Avoid_: User, member, account


**Thread**:
A conversation of its own about one deep topic, with a title naming the topic, such as "Free will".
_Avoid_: Room, channel, topic, conversation

**Message**:
One thing a person writes in a **Thread**, which can be a reply to an earlier **Message** in the same **Thread**.
_Avoid_: Post, comment

**Reply**:
A **Message** in a **Thread**'s main conversation that answers an earlier **Message**, either as a whole or by quoting passages selected from it, each linked to its place in the original.
_Avoid_: Response, quote

**Side discussion**:
The **Messages** kept under one **Message**, out of the **Thread**'s main conversation, as a Slack thread is kept under a message. The name may change.
_Avoid_: Thread, sub-thread, replies

**Link preview**:
The card under a **Message** showing the picture, title and site of the page its first link goes to, as chat apps show one.
_Avoid_: Unfurl, embed

## Relationships

- A **Thread** holds many **Messages**, in the order they were sent.
- A **Thread** has its own list of the **People** in it, two or more, and each **Person** sees every **Thread** they are in.
- For now every **Person** is in every **Thread**: a new **Thread** includes everyone, and a **Person** who joins Juggle is added to every **Thread**.
- Either person can start a **Thread** and change its title; a new **Thread** can have no **Messages** yet.
- A **Thread** stands on its own: it does not hang off a **Message** or any other conversation.

- A **Message** is seen by a **Person** once it has been on their screen; each **Person** has one point in each **Thread**, and in each **Side discussion**, up to which they have seen.
- A **Reply** keeps its own copy of each passage it quotes, so an edit to the original leaves the quoted words as they were answered. Deleting a **Message** removes its words from every **Reply** that quotes it, which then shows only that it was deleted.
- A **Message** in a **Thread**'s main conversation can have one **Side discussion** under it; a **Message** inside a **Side discussion** cannot.
- A **Message** shows one **Link preview**, for its first link, when that page has one. Only the **Message**'s author can remove it, which removes it for everyone.

## Flagged ambiguities

- In Slack a "thread" hangs off one message in a channel. Here a **Thread** stands on its own, more like a WhatsApp group or a Discord channel with one topic.
- Slack and Discord call a side discussion under a message a "thread", which here would clash with **Thread**, so it is a **Side discussion**. It is not called "replies" either, so that **Reply** keeps one meaning.
