'use client'

import { useState } from "react";
import { useAuth } from "@hooks/index";
import { Button } from "@ui/button";
import { Icon } from "@ui/icon";
import { signIn } from "@utils/auth";
import { messenger } from "@utils/messenger";
import type { Relation, RelationStatus } from "@utils/types";

const KIND: Record<Relation, { noun: string; list: string; icon: 'host' | 'sword' }> = {
  friend: { noun: 'Friend', list: 'Friends', icon: 'host' },
  rival: { noun: 'Rival', list: 'Rivals', icon: 'sword' },
}

/**
 * Header actions by relation, one primary at most. Kind changes, removal and blocking live in the
 * messenger, where a linked duelist's buttons lead.
 */
export const RelationActions = ({ id, isOwner, relation }: { id: string; isOwner: boolean; relation: RelationStatus }) => {
  const { user } = useAuth()
  const [status, setStatus] = useState(relation)
  const [isPending, setIsPending] = useState(false)

  if (isOwner) {
    return <Button href="/profile/edit"><Icon name="gear" />Edit profile</Button>
  }

  const run = async (request: () => Promise<RelationStatus | unknown>) => {
    if (!user) return signIn()
    setIsPending(true)
    try {
      const next = await request()
      setStatus(next && typeof next === 'object' && 'state' in next ? (next as RelationStatus) : { state: 'none' })
    } catch (error) {
      console.error(error)
    } finally {
      setIsPending(false)
    }
  }

  switch (status.state) {
    case 'none':
      return (
        <>
          <Button variant="secondary" disabled={isPending} onClick={() => run(() => messenger.request(id, 'rival'))}><Icon name="sword" />Add rival</Button>
          <Button disabled={isPending} onClick={() => run(() => messenger.request(id, 'friend'))}><Icon name="host" />Add friend</Button>
        </>
      )
    case 'outgoing':
      return <Button variant="secondary" disabled><Icon name={KIND[status.kind].icon} />{KIND[status.kind].noun} request sent</Button>
    case 'incoming':
      return (
        <>
          <Button variant="ghost" disabled={isPending} onClick={() => run(() => messenger.remove(id))}><Icon name="close" />Decline</Button>
          <Button disabled={isPending} onClick={() => run(() => messenger.accept(id, 'friend'))}><Icon name="host" />Accept</Button>
        </>
      )
    case 'linked':
      return (
        <>
          <Button variant="secondary" href={`/messenger?with=${id}`}><Icon name={status.kind === 'friend' ? 'user' : 'sword'} />{KIND[status.kind].list}</Button>
          <Button href={`/messenger?with=${id}`}><Icon name="chat" />Message</Button>
        </>
      )
  }
}
