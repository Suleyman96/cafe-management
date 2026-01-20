"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTable } from "@/hooks/use-table";
import { setTableContext } from "@/lib/supabase";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { useLanguageStore } from "@/store/language-store";
import type { Language } from "@/types";
import { MapPin, Users } from "lucide-react";

interface TableLandingProps {
  tableId: string;
  token?: string;
}

export function TableLanding({ tableId, token }: TableLandingProps) {
  const router = useRouter();
  const { data: table, isLoading, error } = useTable(tableId);
  const { language, setLanguage } = useLanguageStore();

  useEffect(() => {
    if (token) {
      setTableContext(token);
    }
  }, [token]);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (error || !table) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-destructive">Invalid Table</h1>
        <p className="mt-2 text-muted-foreground">
          This table QR code is not valid. Please scan a valid QR code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/10 to-background p-6">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-primary">Café İdarə</h1>
          <p className="mt-2 text-muted-foreground">Welcome!</p>
        </div>

        {/* Table Info Card */}
        <div className="w-full bg-card rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">{table.table_number}</h2>
              <p className="text-sm text-muted-foreground">Your Table</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </div>

          {table.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{table.location}</span>
            </div>
          )}

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Capacity: {table.capacity} guests
            </p>
          </div>
        </div>

        {/* Language Selector */}
        <div className="w-full mb-6">
          <p className="text-sm font-medium mb-2 text-center">
            Select Language / Dil seçin
          </p>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { code: "en", label: "EN" },
                { code: "az", label: "AZ" },
                { code: "ru", label: "RU" },
                { code: "tr", label: "TR" },
              ] as const
            ).map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? "default" : "outline"}
                size="lg"
                onClick={() => setLanguage(lang.code as Language)}
                className="font-semibold"
              >
                {lang.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Browse Menu Button */}
        <Button
          size="xl"
          className="w-full"
          onClick={() => router.push(`/table/${tableId}/menu`)}
        >
          Browse Menu
        </Button>

        <p className="mt-4 text-sm text-center text-muted-foreground">
          Scan the QR code on your table to order
        </p>
      </div>
    </div>
  );
}


