import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { ImageComparisonSlider } from "@/components/image-comparison-slider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Camera, Sparkles, ArrowLeftRight } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { PageNavigation } from "@/components/page-navigation";

type ColorChoice = "white" | "gray";

export default function BeforeAfter() {
  const { images, proposal, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "visualizer" }); }, []);

  const [selectedColor, setSelectedColor] = useState<ColorChoice>("white");
  const [activeBeforeIdx, setActiveBeforeIdx] = useState(0);

  const beforeImages = useMemo(() => images.filter(img => img.imageType === "before"), [images]);
  const aiWhiteImages = useMemo(() => images.filter(img => img.imageType === "ai_white"), [images]);
  const aiGrayImages = useMemo(() => images.filter(img => img.imageType === "ai_gray"), [images]);

  // Match AI images to before images by source ID in caption
  const getAiImage = (beforeId: number, color: ColorChoice) => {
    const pool = color === "white" ? aiWhiteImages : aiGrayImages;
    return pool.find(img => img.caption?.includes(`source:${beforeId}`));
  };

  const hasTransformations = aiWhiteImages.length > 0 || aiGrayImages.length > 0;
  const currentBefore = beforeImages[activeBeforeIdx];
  const currentAi = currentBefore ? getAiImage(currentBefore.id, selectedColor) : null;

  // Standalone AI images (no before images to pair with)
  const standaloneAiImages = hasTransformations && beforeImages.length === 0;
  const currentStandaloneAi = standaloneAiImages
    ? (selectedColor === "white" ? aiWhiteImages : aiGrayImages)
    : [];

  // If no before images or no AI images at all, show placeholder
  if (beforeImages.length === 0 && !hasTransformations) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-visualizer">
        <PageHeader
          title="Roof Transformation Preview"
          subtitle="See what your roof will look like with silicone coating"
          icon={<ImageIcon className="w-5 h-5" />}
        />
        <Card>
          <CardContent className="p-12 text-center">
            <Camera className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground mb-2">Transformation Preview Coming Soon</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Once your estimator uploads job-walk photos, our AI will generate a realistic preview
              of what your roof will look like with a professional silicone coating — in both gray and white finishes.
            </p>
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400 border" />
                <span className="text-xs text-muted-foreground">Gray Silicone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-white border" />
                <span className="text-xs text-muted-foreground">White Silicone</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-visualizer">
      <PageHeader
        title="Roof Transformation Preview"
        subtitle="Drag the slider to see the difference — powered by AI"
        icon={<Sparkles className="w-5 h-5" />}
      />

      {/* Color Toggle — shared between slider and standalone modes */}
      {hasTransformations && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  AI Roof Visualization
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See how your roof will look with silicone coating applied
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedColor === "white" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8 gap-2"
                  onClick={() => setSelectedColor("white")}
                  data-testid="button-color-white"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white border border-gray-300" />
                  White Silicone
                </Button>
                <Button
                  variant={selectedColor === "gray" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8 gap-2"
                  onClick={() => setSelectedColor("gray")}
                  data-testid="button-color-gray"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-gray-400 border border-gray-500" />
                  Gray Silicone
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Transformation Slider Section (when before images exist) */}
      {hasTransformations && currentBefore && (
        <div className="space-y-4">
          {/* Slider */}
          {currentAi ? (
            <ImageComparisonSlider
              beforeSrc={currentBefore.imageUrl}
              afterSrc={currentAi.imageUrl}
              beforeLabel="Current Condition"
              afterLabel={`${selectedColor === "white" ? "White" : "Gray"} Silicone Finish`}
              className="aspect-[4/3]"
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {selectedColor === "white" ? "White" : "Gray"} silicone preview not yet generated for this photo.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedColor === "white" && aiGrayImages.length > 0 ? "Try switching to gray to see the available preview." : ""}
                  {selectedColor === "gray" && aiWhiteImages.length > 0 ? "Try switching to white to see the available preview." : ""}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Photo Selector (if multiple before photos) */}
          {beforeImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {beforeImages.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setActiveBeforeIdx(idx)}
                  className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === activeBeforeIdx
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid={`button-photo-${idx}`}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.caption || `Photo ${idx + 1}`}
                    className="w-20 h-14 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Standalone AI Gallery (AI images exist but no before photos to pair) */}
      {standaloneAiImages && (
        <div className="space-y-4">
          {aiWhiteImages.length > 0 && aiGrayImages.length > 0 ? (
            <ImageComparisonSlider
              beforeSrc={(selectedColor === "white" ? aiGrayImages : aiWhiteImages)[0]?.imageUrl || ""}
              afterSrc={(selectedColor === "white" ? aiWhiteImages : aiGrayImages)[0]?.imageUrl || ""}
              beforeLabel={selectedColor === "white" ? "Gray Silicone" : "White Silicone"}
              afterLabel={selectedColor === "white" ? "White Silicone" : "Gray Silicone"}
              className="aspect-[4/3]"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentStandaloneAi.map((img) => (
                <Card key={img.id} className="overflow-hidden">
                  <img
                    src={img.imageUrl}
                    alt={img.caption || "AI Preview"}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">
                        {selectedColor === "white" ? "White" : "Gray"} Silicone
                      </Badge>
                      {img.caption && (
                        <span className="text-xs text-muted-foreground truncate">{img.caption}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Second comparison if we have 2+ images */}
          {aiWhiteImages.length > 1 && aiGrayImages.length > 1 && (
            <ImageComparisonSlider
              beforeSrc={(selectedColor === "white" ? aiGrayImages : aiWhiteImages)[1]?.imageUrl || ""}
              afterSrc={(selectedColor === "white" ? aiWhiteImages : aiGrayImages)[1]?.imageUrl || ""}
              beforeLabel={selectedColor === "white" ? "Gray Silicone" : "White Silicone"}
              afterLabel={selectedColor === "white" ? "White Silicone" : "Gray Silicone"}
              className="aspect-[4/3]"
            />
          )}
        </div>
      )}

      {/* Info callout */}
      {hasTransformations && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">AI-Powered Visualization</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This preview was generated from your actual roof photos using artificial intelligence.
                It shows a realistic approximation of the finished silicone coating. Actual results may vary
                slightly based on roof conditions and application technique.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Original Before/After Gallery (for non-AI images or as additional reference) */}
      {beforeImages.length > 0 && !hasTransformations && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Job-Walk Photos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {beforeImages.map((img) => (
              <Card key={img.id}>
                <CardContent className="p-0">
                  <img src={img.imageUrl} alt={img.caption || "Before"} className="w-full h-48 object-cover rounded-t-md" />
                  <div className="p-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">Before</Badge>
                    {img.caption && <span className="text-xs text-muted-foreground truncate">{img.caption}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Benefits callout */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Why Silicone Roof Coating?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: "Energy Savings", desc: "Reflective coating reduces cooling costs by up to 30%" },
              { title: "Extends Roof Life", desc: "Adds 15-20 years without a full tear-off replacement" },
              { title: "Waterproof Seal", desc: "Silicone naturally sheds water — even in ponding conditions" },
              { title: "Tax Deductible", desc: "Qualifies for Section 179 and energy efficiency credits" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <PageNavigation />
    </div>
  );
}
