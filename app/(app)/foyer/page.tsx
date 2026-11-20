import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppPage } from "@/components/app-page";
import { FormSubmit } from "@/components/form-submit";
import type { Organizer } from "@/components/household-organizers";
import { MemberAvatar } from "@/components/member-avatar";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { Loading } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadHouseholdAccounts } from "@/lib/accounts-data";
import { loadHousehold } from "@/lib/data";
import { accountLabel, canManageAccounts, claimableMembers, leavePlan } from "@/lib/household-accounts";
import { summarizeMeals } from "@/lib/meal-slots";
import { avatarInitials, describeMember } from "@/lib/members";
import { todayInParis } from "@/lib/week";
import { signOut } from "@/app/connexion/actions";
import { LeaveHousehold } from "./leave-household";
import { OrganizersSection } from "./organizers-section";
import { WhoAmIPrompt } from "./who-am-i-prompt";

export const metadata: Metadata = { title: "Le foyer" };

// Le foyer : son nom, qui mange quand, qui est à table, qui organise les repas, et la sortie.
export default function HouseholdPage() {
  return (
    <AppPage narrow>
      <Suspense fallback={<Loading />}>
        <Dashboard />
      </Suspense>
    </AppPage>
  );
}

async function Dashboard() {
  const { supabase, household, members, slots, step } = await loadHousehold();
  // Parcours inachevé : on reprend là où il s'est arrêté.
  if (step !== null || !household) redirect(step ?? "/bienvenue");

  const { accounts, invites } = await loadHouseholdAccounts(supabase, household.id);
  const today = todayInParis();
  const currentYear = new Date().getFullYear();
  const meals = summarizeMeals(slots, members);

  const initials = avatarInitials(members.map((member) => member.first_name));
  const avatars = members.map((member, index) => ({
    id: member.id,
    first_name: member.first_name,
    color: member.color,
    initials: initials[index],
  }));
  const me = accounts.find((account) => account.is_me);
  const organizers: Organizer[] = accounts.map((account) => ({
    userId: account.user_id,
    label: accountLabel(account, members),
    email: account.email,
    member: avatars.find((avatar) => avatar.id === account.member_id) ?? null,
    canInvite: account.role === "admin",
    isMe: account.is_me,
  }));
  const choices = claimableMembers(avatars, accounts);
  const plan = leavePlan(accounts);
  const successor = plan.successor ? accountLabel(plan.successor, members) : null;

  return (
    <>
      <PageHeader title={household.name} />
      <Button asChild variant="link" className="mt-1 -ml-1">
        <Link href="/bienvenue">Renommer le foyer</Link>
      </Button>

      {me && me.member_chosen_at === null && (
        <div className="mt-8">
          <WhoAmIPrompt members={choices} />
        </div>
      )}

      <section aria-labelledby="meals-title" className="mt-10">
        <SectionHeader
          id="meals-title"
          title="Les repas de la semaine"
          action={
            <Button asChild variant="link">
              <Link href="/bienvenue/repas" aria-label="Modifier les repas">
                Modifier
              </Link>
            </Button>
          }
        />
        <Card className="mt-4 gap-0 px-4 py-1">
          {meals.map((meal) => (
            <div
              key={meal.label}
              className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-border/70 py-3.5 last:border-b-0"
            >
              <h3 className="font-heading text-lg leading-snug text-tomato-deep">{meal.label}</h3>
              <ul className="space-y-2.5">
                {meal.lines.map((line) => (
                  <li key={`${line.who}|${line.when}`}>
                    <span className="block font-semibold">{line.who}</span>
                    <span className="block text-[0.9375rem] text-muted-foreground">{line.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </section>

      <section aria-labelledby="table-title" className="mt-10">
        <SectionHeader
          id="table-title"
          title="À table"
          action={
            <Button asChild variant="link">
              <Link href="/bienvenue/membres" aria-label="Modifier les membres">
                Modifier
              </Link>
            </Button>
          }
        />
        <Card className="mt-4 gap-0 px-4 py-1">
          <ul>
            {members.map((member, index) => (
              <li key={member.id} className="flex items-center gap-3 border-b border-border/70 py-3 last:border-b-0">
                <MemberAvatar member={avatars[index]} />
                <span className="min-w-0">
                  <span className="block font-semibold">{member.first_name}</span>
                  <span className="block text-[0.9375rem] text-muted-foreground">
                    {describeMember(member, currentYear)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <OrganizersSection
        householdName={household.name}
        organizers={organizers}
        invites={invites.map((invite) => ({
          id: invite.id,
          code: invite.code,
          canInvite: invite.role === "admin",
          expiresAt: invite.expires_at,
        }))}
        canManage={canManageAccounts(me?.role)}
        choices={choices}
        myMemberId={me?.member_chosen_at ? me.member_id : undefined}
        today={today}
      />

      <div className="mt-14 flex flex-col items-center gap-4">
        <LeaveHousehold consequence={plan.consequence} successor={successor} />
        <form action={signOut} className="w-full">
          <FormSubmit variant="secondary" block pendingLabel="Déconnexion…">
            Se déconnecter
          </FormSubmit>
        </form>
      </div>
    </>
  );
}
