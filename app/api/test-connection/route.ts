
import { connection, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  await connection();

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("establishments")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Falha ao consultar o Supabase na rota de diagnóstico.");

      return NextResponse.json(
        {
          connected: false,
          message: "Falha ao consultar o banco de dados.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "Conexão com Supabase estabelecida com sucesso!",
    });
  } catch (error) {
    console.error(
      "Não foi possível concluir a verificação do Supabase.",
      error instanceof Error ? error.name : "UnknownError"
    );

    return NextResponse.json(
      {
        connected: false,
        message: "Não foi possível conectar ao Supabase.",
      },
      { status: 500 }
    );
  }
}
