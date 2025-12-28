import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ProfileForm from "./profile"; // 

type ProfileData = {
  firstName: string;
  lastName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  phone: string;
  email: string;
  nationality: string;
  address1: string;
  address2: string;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<Partial<ProfileData>>({});
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      if (!session) {
        navigate("/signin", { replace: true });
        return;
      }

      const user = session.user;
      const email = (user.email ?? "").toLowerCase();
      setUserEmail(email);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) console.error("Load profile error:", error);

      setInitial({
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        dobDay: profile?.dob_day ?? "01",
        dobMonth: profile?.dob_month ?? "01",
        dobYear: profile?.dob_year ?? "1995",
        phone: profile?.phone ?? "",
        email, // show auth email
        nationality: profile?.nationality ?? "Singapore",
        address1: profile?.address1 ?? "",
        address2: profile?.address2 ?? "",
      });
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <ProfileForm
      userName="My Profile"
      userEmail={userEmail}
      initial={initial}
      onSave={async (form) => {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) throw new Error("Not logged in");

        const { error } = await supabase.from("profiles").upsert({
          id: user.id,
          first_name: form.firstName,
          last_name: form.lastName,
          dob_day: form.dobDay,
          dob_month: form.dobMonth,
          dob_year: form.dobYear,
          phone: form.phone,
          nationality: form.nationality,
          address1: form.address1,
          address2: form.address2,
          updated_at: new Date().toISOString(),
        });

        if (error) throw error;

        alert("Saved to Supabase!");
      }}
    />
  );
}