'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import BackdropComponent from '@components/backdrop/backdrop.component'
import ButtonComponent from '@components/button/button.component'
import IconComponent from '@components/icon/icon.component'
import ToggleComponent from '@components/toggle/toggle.component'
import type { ToggleOption } from '@components/toggle/toggle.types'
import FavoriteCardPicker from './favorite-card-picker.component'
import { updateDuelist } from './profile-edit.api'
import type { CardOption, ProfileEditValues } from './profile-edit.types'

// Lexical touches the DOM on creation (HTML import) — mount it client-only.
const BioEditor = dynamic(() => import('./bio-editor.component'), {
  ssr: false,
  loading: () => <div className="profile-edit__editor-skeleton" aria-hidden="true" />,
})

// The cropper reaches for the DOM/canvas — client-only, and only loaded once a
// file is actually picked.
const CoverCropper = dynamic(() => import('./cover-cropper.component'), { ssr: false })

const MAX_COVER_BYTES = 5 * 1024 * 1024

type SocialField = {
  key: 'socialX' | 'socialInstagram' | 'socialYoutube' | 'socialTwitch'
  label: string
  icon: string
  placeholder: string
}

const SOCIAL_FIELDS: SocialField[] = [
  { key: 'socialX', label: 'X', icon: 'mdi:twitter', placeholder: 'yourhandle' },
  { key: 'socialInstagram', label: 'Instagram', icon: 'mdi:instagram', placeholder: 'yourhandle' },
  { key: 'socialYoutube', label: 'YouTube', icon: 'mdi:youtube', placeholder: 'yourhandle' },
  { key: 'socialTwitch', label: 'Twitch', icon: 'mdi:twitch', placeholder: 'yourhandle' },
]

type Visibility = 'public' | 'private'

const VISIBILITY_OPTIONS: ToggleOption<Visibility>[] = [
  { value: 'public', label: 'Public', icon: 'mdi:earth' },
  { value: 'private', label: 'Private', icon: 'mdi:lock-outline' },
]

type ProfileEditClientProps = {
  userId: string
  initialValues: ProfileEditValues
}

const ProfileEditClient = ({ userId, initialValues }: ProfileEditClientProps) => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<ProfileEditValues>(initialValues)
  const [coverPreview, setCoverPreview] = useState(initialValues.coverUrl)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Cover preview: a freshly chosen File shows via an object URL (revoked when
  // it changes/unmounts); otherwise fall back to the already-saved banner.
  useEffect(() => {
    const url = values.coverFile ? URL.createObjectURL(values.coverFile) : values.coverUrl
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the chosen File / saved banner into the preview; object URL revoked on cleanup
    setCoverPreview(url)
    return () => {
      if (values.coverFile) URL.revokeObjectURL(url)
    }
  }, [values.coverFile, values.coverUrl])

  const patch = (next: Partial<ProfileEditValues>) => setValues((prev) => ({ ...prev, ...next }))

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-picking the same file after a clear
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Cover must be an image file.')
      return
    }
    if (file.size > MAX_COVER_BYTES) {
      setError('Cover image must be 5 MB or smaller.')
      return
    }
    setError(null)
    // Open the cropper on the raw file; only the cropped result becomes coverFile.
    setCropSrc(URL.createObjectURL(file))
  }

  const closeCropper = () => {
    setCropSrc((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await updateDuelist({
        id: userId,
        bio: values.bio,
        duelistFavorite: values.favorite ?? undefined,
        socialX: values.socialX.trim() || undefined,
        socialInstagram: values.socialInstagram.trim() || undefined,
        socialYoutube: values.socialYoutube.trim() || undefined,
        socialTwitch: values.socialTwitch.trim() || undefined,
        coverImage: values.coverFile ?? undefined,
        hideMatchHistory: values.hideMatchHistory,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.push(`/profile/${userId}`)
      router.refresh()
    })
  }

  return (
    <div className="profile-edit">
      <BackdropComponent />

      <div className="profile-edit__content omega-container omega-container--narrow">
        <header className="profile-edit__header">
          <span className="profile-edit__kicker">
            <span className="profile-edit__kicker-mark" aria-hidden="true" />
            Your Profile
          </span>
          <h1 className="profile-edit__title">Edit Profile</h1>
          <p className="profile-edit__lead">
            Customize how other duelists see you — your cover, bio, favorite card and socials.
          </p>
        </header>

        <form className="profile-edit__form" onSubmit={handleSubmit} noValidate>
          {error ? (
            <p className="profile-edit__error" role="alert">
              <IconComponent icon="mdi:alert-circle-outline" width={16} height={16} />
              {error}
            </p>
          ) : null}

          {/* Cover */}
          <section className="profile-edit__field">
            <span className="profile-edit__label">Cover image</span>
            <div
              className="profile-edit__cover"
              style={coverPreview ? { backgroundImage: `url(${coverPreview})` } : undefined}
              data-empty={coverPreview ? undefined : 'true'}
            >
              {!coverPreview ? (
                <span className="profile-edit__cover-empty">
                  <IconComponent icon="mdi:image-outline" width={28} height={28} />
                  No cover yet
                </span>
              ) : null}
              <div className="profile-edit__cover-actions">
                <ButtonComponent
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="mdi:upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {coverPreview ? 'Change cover' : 'Upload cover'}
                </ButtonComponent>
                {values.coverFile ? (
                  <ButtonComponent
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon="mdi:undo"
                    onClick={() => patch({ coverFile: null })}
                  >
                    Discard
                  </ButtonComponent>
                ) : null}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="profile-edit__file"
              onChange={handleCoverChange}
            />
            <p className="profile-edit__hint">
              PNG or JPG up to 5 MB. You&apos;ll position and crop it to a 3:1 banner.
            </p>
          </section>

          {/* Bio */}
          <section className="profile-edit__field">
            <span className="profile-edit__label">Bio</span>
            <BioEditor initialHtml={initialValues.bio} onChange={(bio) => patch({ bio })} />
            <p className="profile-edit__hint">Supports bold, italic, underline, lists and links.</p>
          </section>

          {/* Favorite card */}
          <section className="profile-edit__field">
            <label htmlFor="favorite-card" className="profile-edit__label">
              Favorite card
            </label>
            <FavoriteCardPicker
              id="favorite-card"
              value={values.favorite}
              onChange={(favorite: CardOption | null) => patch({ favorite })}
            />
          </section>

          {/* Socials */}
          <section className="profile-edit__field">
            <span className="profile-edit__label">Social links</span>
            <div className="profile-edit__socials">
              {SOCIAL_FIELDS.map((field) => (
                <div key={field.key} className="profile-edit__social">
                  <span className={`profile-edit__social-icon profile-edit__social-icon--${field.key}`}>
                    <IconComponent icon={field.icon} width={18} height={18} />
                  </span>
                  <span className="profile-edit__social-prefix">@</span>
                  <input
                    type="text"
                    className="profile-edit__social-input"
                    aria-label={field.label}
                    placeholder={field.placeholder}
                    autoComplete="off"
                    value={values[field.key]}
                    onChange={(event) => patch({ [field.key]: event.target.value })}
                  />
                </div>
              ))}
            </div>
            <p className="profile-edit__hint">Just your handle — we build the full link for you.</p>
          </section>

          {/* Privacy */}
          <section className="profile-edit__field">
            <span className="profile-edit__label">Match history</span>
            <ToggleComponent
              options={VISIBILITY_OPTIONS}
              value={values.hideMatchHistory ? 'private' : 'public'}
              onChange={(value) => patch({ hideMatchHistory: value === 'private' })}
              ariaLabel="Match history visibility"
            />
            <p className="profile-edit__hint">
              {values.hideMatchHistory
                ? 'Your competitive record is hidden from other players.'
                : 'Anyone can see your match history and stats.'}
            </p>
          </section>

          <div className="profile-edit__actions">
            <ButtonComponent type="submit" variant="primary" icon="mdi:content-save" loading={isPending}>
              Save changes
            </ButtonComponent>
            <ButtonComponent to={`/profile/${userId}`} variant="ghost">
              Cancel
            </ButtonComponent>
          </div>
        </form>
      </div>

      {cropSrc ? (
        <CoverCropper
          src={cropSrc}
          fileName="cover.jpg"
          onCancel={closeCropper}
          onCropped={(file) => {
            patch({ coverFile: file })
            closeCropper()
          }}
        />
      ) : null}
    </div>
  )
}

export default ProfileEditClient
