import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileMemoryContent } from "@/pages/ProfileMemoryPage";
import type { ProfileTone, ResponseStyle } from "@/types";

const schema = z.object({
  role: z.string().min(1, "Role is required"),
  tone: z.enum(["professional", "casual", "concise", "detailed"]),
  response_style: z.enum(["technical", "conversational", "bullet-points", "narrative"]),
});

type FormValues = z.infer<typeof schema>;

function TagInput({
  label,
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  };

  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="ml-0.5 rounded-full hover:bg-muted p-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type and press Enter"}
      />
    </div>
  );
}

export function ProfilePage() {
  const { profile, isLoading, createProfile, updateProfile } = useProfile();
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "", tone: "professional", response_style: "technical" },
  });

  useEffect(() => {
    if (profile) {
      reset({
        role: profile.role,
        tone: profile.tone as ProfileTone,
        response_style: profile.response_style as ResponseStyle,
      });
      setSkills(profile.skills);
      setLanguages(profile.programming_languages);
      setFrameworks(profile.frameworks);
    }
  }, [profile, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      ...values,
      skills,
      programming_languages: languages,
      frameworks,
    };
    if (profile) {
      await updateProfile(payload);
    } else {
      await createProfile(payload);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Who you are — your personal memory and your identity for AI tools, in one place."
      />

      <Tabs defaultValue="memory">
        <TabsList className="mb-6">
          <TabsTrigger value="memory">Profile Memory</TabsTrigger>
          <TabsTrigger value="identity">AI Identity</TabsTrigger>
        </TabsList>

        {/* ── Profile Memory — everything about you as ONE memory ─────────── */}
        <TabsContent value="memory">
          <ProfileMemoryContent />
        </TabsContent>

        {/* ── AI Identity — the original profile form, unchanged ──────────── */}
        <TabsContent value="identity">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Who you are and how you work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="role" className="mb-1.5 block">Role</Label>
              <Input
                id="role"
                placeholder="e.g. Full-stack engineer, ML researcher, Product designer"
                {...register("role")}
              />
              {errors.role && (
                <p className="mt-1 text-xs text-destructive">{errors.role.message}</p>
              )}
            </div>

            <TagInput
              label="Skills"
              tags={skills}
              onAdd={v => setSkills(prev => [...new Set([...prev, v])])}
              onRemove={v => setSkills(prev => prev.filter(s => s !== v))}
              placeholder="e.g. React, system design, FastAPI…"
            />
          </CardContent>
        </Card>

        {/* Communication preferences */}
        <Card>
          <CardHeader>
            <CardTitle>AI preferences</CardTitle>
            <CardDescription>How you want AI tools to communicate with you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-1.5 block">Preferred tone</Label>
              <Select
                value={watch("tone")}
                onValueChange={v => setValue("tone", v as ProfileTone, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Response style</Label>
              <Select
                value={watch("response_style")}
                onValueChange={v => setValue("response_style", v as ResponseStyle, { shouldDirty: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="bullet-points">Bullet points</SelectItem>
                  <SelectItem value="narrative">Narrative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tech preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Technical context</CardTitle>
            <CardDescription>Languages and frameworks you work with.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TagInput
              label="Programming languages"
              tags={languages}
              onAdd={v => setLanguages(prev => [...new Set([...prev, v])])}
              onRemove={v => setLanguages(prev => prev.filter(l => l !== v))}
              placeholder="e.g. Python, TypeScript, Go…"
            />
            <TagInput
              label="Frameworks & tools"
              tags={frameworks}
              onAdd={v => setFrameworks(prev => [...new Set([...prev, v])])}
              onRemove={v => setFrameworks(prev => prev.filter(f => f !== v))}
              placeholder="e.g. React, FastAPI, Postgres…"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : profile ? (
              "Save changes"
            ) : (
              "Create profile"
            )}
          </Button>
        </div>
      </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
