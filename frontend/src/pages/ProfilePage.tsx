import { PageHeader } from "@/components/common/PageHeader";
import { ProfileMemoryContent } from "@/pages/ProfileMemoryPage";

export function ProfilePage() {
  return (
    <div>
      <PageHeader
        title="Profile"
        description="Everything about you, stored as one searchable memory."
      />
      <ProfileMemoryContent />
    </div>
  );
}
