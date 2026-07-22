import { Duelist } from "./profile-edit.types";
import { apiFailure, apiSuccess } from "@lib/api-result";
import { ProfileCustomizationData } from "../profile.types";
import { dispatchAuthExpired } from "@contexts/Auth/auth.events";

export const updateDuelist = async (duelist: Duelist) => {
  const formData = new FormData();
  formData.append('id', duelist.id);
  formData.append('duelistBio', duelist.bio);
  duelist.duelistFavorite && formData.append('duelistFavorite', duelist.duelistFavorite.id);
  duelist.socialX && formData.append('socialX', duelist.socialX);
  duelist.socialInstagram && formData.append('socialInstagram', duelist.socialInstagram);
  duelist.socialYoutube && formData.append('socialYoutube', duelist.socialYoutube);
  duelist.socialTwitch && formData.append('socialTwitch', duelist.socialTwitch);
  duelist.coverImage && formData.append('coverImage', duelist.coverImage);
  formData.append('hideHistory', duelist.hideMatchHistory ? '1' : '0');

  // Goes through the /api/duelist proxy so the httpOnly session cookie is
  // forwarded as a Bearer token (the browser can't read it directly).
  const request = await fetch('/api/duelist', {
    method: "POST",
    body: formData,
  });

  if (request.status === 401) {
    dispatchAuthExpired('Session expired');
    return apiFailure('You need to be logged in to edit your profile');
  }

  if (!request.ok) {
    return apiFailure('Failed to update profile')
  }

  const data: ProfileCustomizationData = (await request.json())?.data

  if (!data) {
    return apiFailure('Invalid customization response')
  }

  return apiSuccess(data);
}
