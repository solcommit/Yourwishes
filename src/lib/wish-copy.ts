// Presentation only: persisted priorities and API validation contracts stay English.
export const priorityLabel = { Common: "Байвал гоё", Uncommon: "Авмаар байна", Rare: "Хэрэгтэй", Epic: "Маш хэрэгтэй", Legendary: "Нэн шаардлагатай" } as const;

export function wishUiError(error: unknown, action: "save" | "photo" | "delete" = "save"): string {
  const message = error instanceof Error ? error.message : "";
  if (/database priority schema is outdated/.test(message)) return "Database-ийн priority тохиргоо хуучин байна. item_grade_priority SQL migration-ийг ажиллуулах шаардлагатай.";
  if (/database currency schema is outdated/.test(message)) return "Database-ийн валютын тохиргоо хуучин байна. CNY currency SQL migration-ийг ажиллуулах шаардлагатай.";
  if (/database save function is unavailable/.test(message)) return "Database-ийн хадгалах функц олдсонгүй. Wishlist storage SQL migration-ийг шалгах шаардлагатай.";
  if (/database rejected wish ownership or permissions/.test(message)) return "Database хадгалах эрхийг зөвшөөрсөнгүй. Дахин нэвтрээд оролдоорой; үргэлжилбэл member policy-г шалгана.";
  if (/Photo-free wishes are not enabled/.test(message)) return "Зураггүй хадгалах боломж хараахан идэвхжээгүй байна.";
  if (/offline|fetch|network|refresh/i.test(message)) return "Холболтоо шалгаад дахин оролдоорой. Таны оруулсан зүйлс хэвээрээ байгаа.";
  if (/name between|name.*long/i.test(message)) return "Хүслийн нэрээ 100 тэмдэгтэд багтаан бичээрэй.";
  if (/Description or category/i.test(message)) return "Тайлбар эсвэл ангиллын нэрээ бага зэрэг товчлоорой.";
  if (/price|nonnegative/i.test(message)) return "Үнээ зөв оруулна уу. Бутархай хэсэг нь хоёр оронтой байж болно.";
  if (/HTTP|product URL/i.test(message)) return "Бүтээгдэхүүний зөв холбоос оруулна уу (https://…).";
  if (/1.*5|up to 5|distinct images/i.test(message)) return "Тав хүртэлх зураг нэмнэ үү. Зураг давхардаж болохгүй.";
  if (/32 MiB|too large|dimensions|smaller|5 MiB/i.test(message)) return "Энэ зураг хэт том байна. Бага хэмжээтэй хувилбарыг сонгоод дахин оролдоорой.";
  if (/changed|already saved|version/i.test(message)) return "Энэ хүсэлд өөрчлөлт орсон байна. Жагсаалтаа шинэчлээд дахин оролдоорой.";
  if (/sign in/i.test(message)) return "Дахин нэвтэрч орно уу.";
  if (/currency|USD|MNT/i.test(message)) return "Валютаа сонгоно уу.";
  if (/priority/i.test(message)) return "Ач холбогдлыг сонгоно уу.";
  if (/photo.*unavailable|image ownership/i.test(message)) return "Энэ зураг олдсонгүй. Хасаад дахин нэмээрэй.";
  return action === "photo" ? "Зургийг бэлдэж чадсангүй. Өөр зураг сонгох эсвэл JPEG хувилбараар дахин оролдоорой." : action === "delete" ? "Устгаж чадсангүй. Холболтоо шалгаад дахин оролдоорой." : "Хадгалж чадсангүй. Оруулсан зүйлс тань хэвээрээ байгаа тул дахин оролдоорой.";
}

export function wishPhotoProgress(message: string) {
  const count = message.match(/Photo (\d+) of (\d+)/);
  return count ? `${count[1]}/${count[2]} зургийг бэлдэж байна…` : "Зургийг бэлдэж байна…";
}
