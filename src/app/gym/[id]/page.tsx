"use client";

import { use } from "react";
import { useLanguage } from "@/contexts/language-context";
import { CommunityPostDetail } from "@/components/community/community-post-detail";

export default function GymPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useLanguage();
  const { id } = use(params);

  return (
    <CommunityPostDetail
      id={id}
      board="gym"
      backLabel={t.gym.back}
    />
  );
}
