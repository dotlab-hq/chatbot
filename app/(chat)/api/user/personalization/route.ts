import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { personalization } from "@/lib/db/schema";

type VisualSettings = {
  theme: string;
  font: string;
  fontSize: string;
  spacing: string;
  showAvatars: boolean;
};

type AiSettings = {
  baseStyle: string;
  warm: string;
  enthusiastic: string;
  headersAndLists: string;
  emoji: string;
  customInstructions: string;
  nickname: string;
  occupation: string;
  moreAboutYou: string;
};

type PersonalizationData = VisualSettings & AiSettings;

const VISUAL_DEFAULTS: VisualSettings = {
  theme: "modern",
  font: "sora",
  fontSize: "m",
  spacing: "compact",
  showAvatars: false,
};

const AI_DEFAULTS: AiSettings = {
  baseStyle: "default",
  warm: "default",
  enthusiastic: "default",
  headersAndLists: "default",
  emoji: "default",
  customInstructions: "",
  nickname: "",
  occupation: "",
  moreAboutYou: "",
};

const DEFAULTS: PersonalizationData = { ...VISUAL_DEFAULTS, ...AI_DEFAULTS };

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ settings: DEFAULTS });
    }

    const row = await db
      .select()
      .from(personalization)
      .where(eq(personalization.userId, session.user.id))
      .limit(1);

    if (row.length === 0) {
      return NextResponse.json({ settings: DEFAULTS });
    }

    const r = row[0];
    return NextResponse.json({
      settings: {
        theme: r.theme,
        font: r.font,
        fontSize: r.fontSize,
        spacing: r.spacing,
        showAvatars: r.showAvatars,
        baseStyle: r.baseStyle,
        warm: r.warm,
        enthusiastic: r.enthusiastic,
        headersAndLists: r.headersAndLists,
        emoji: r.emoji,
        customInstructions: r.customInstructions ?? "",
        nickname: r.nickname ?? "",
        occupation: r.occupation ?? "",
        moreAboutYou: r.moreAboutYou ?? "",
      },
    });
  } catch (error) {
    console.error("Failed to load personalization:", error);
    return NextResponse.json({ settings: DEFAULTS });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<PersonalizationData>;

    const updateData: Record<string, string | boolean> = {};
    if (body.theme !== undefined) {
      updateData.theme = body.theme;
    }
    if (body.font !== undefined) {
      updateData.font = body.font;
    }
    if (body.fontSize !== undefined) {
      updateData.fontSize = body.fontSize;
    }
    if (body.spacing !== undefined) {
      updateData.spacing = body.spacing;
    }
    if (body.showAvatars !== undefined) {
      updateData.showAvatars = body.showAvatars;
    }
    if (body.baseStyle !== undefined) {
      updateData.baseStyle = body.baseStyle;
    }
    if (body.warm !== undefined) {
      updateData.warm = body.warm;
    }
    if (body.enthusiastic !== undefined) {
      updateData.enthusiastic = body.enthusiastic;
    }
    if (body.headersAndLists !== undefined) {
      updateData.headersAndLists = body.headersAndLists;
    }
    if (body.emoji !== undefined) {
      updateData.emoji = body.emoji;
    }
    if (body.customInstructions !== undefined) {
      updateData.customInstructions = body.customInstructions;
    }
    if (body.nickname !== undefined) {
      updateData.nickname = body.nickname;
    }
    if (body.occupation !== undefined) {
      updateData.occupation = body.occupation;
    }
    if (body.moreAboutYou !== undefined) {
      updateData.moreAboutYou = body.moreAboutYou;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const existing = await db
      .select({ id: personalization.id })
      .from(personalization)
      .where(eq(personalization.userId, session.user.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(personalization).values({
        userId: session.user.id,
        ...updateData,
      } as typeof personalization.$inferInsert);
    } else {
      await db
        .update(personalization)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(personalization.userId, session.user.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save personalization:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db
      .delete(personalization)
      .where(eq(personalization.userId, session.user.id));

    return NextResponse.json({ success: true, settings: DEFAULTS });
  } catch (error) {
    console.error("Failed to reset personalization:", error);
    return NextResponse.json(
      { error: "Failed to reset settings" },
      { status: 500 }
    );
  }
}
