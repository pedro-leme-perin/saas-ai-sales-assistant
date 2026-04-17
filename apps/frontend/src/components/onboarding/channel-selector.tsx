"use client";

import { Check, MessageSquare, Phone } from "lucide-react";

interface Channel {
  id: string;
  label: string;
  description: string;
  icon: typeof Phone;
}

const CHANNELS: Channel[] = [
  {
    id: "phone",
    label: "Phone Calls",
    description:
      "Real-time AI transcription and live suggestions during sales calls via Twilio.",
    icon: Phone,
  },
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    description:
      "AI-powered contextual reply suggestions for WhatsApp conversations.",
    icon: MessageSquare,
  },
];

interface ChannelSelectorProps {
  selected: string[];
  onChange: (channels: string[]) => void;
}

export function ChannelSelector({ selected, onChange }: ChannelSelectorProps) {
  function toggle(channelId: string) {
    if (selected.includes(channelId)) {
      onChange(selected.filter((id) => id !== channelId));
    } else {
      onChange([...selected, channelId]);
    }
  }

  return (
    <div className="space-y-4">
      {CHANNELS.map((channel) => {
        const isSelected = selected.includes(channel.id);
        const Icon = channel.icon;

        return (
          <button
            key={channel.id}
            type="button"
            onClick={() => toggle(channel.id)}
            className={[
              "w-full p-5 rounded-xl border-2 text-left transition-all duration-200",
              isSelected
                ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 shadow-sm"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600",
            ].join(" ")}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={[
                  "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-colors duration-200",
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                ].join(" ")}
              >
                <Icon className="w-6 h-6" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3
                  className={[
                    "font-semibold text-base transition-colors duration-200",
                    isSelected
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-900 dark:text-white",
                  ].join(" ")}
                >
                  {channel.label}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {channel.description}
                </p>
              </div>

              {/* Check badge */}
              <div
                className={[
                  "flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0 mt-0.5 transition-all duration-200",
                  isSelected
                    ? "border-blue-600 bg-blue-600 scale-100"
                    : "border-gray-300 dark:border-gray-600 scale-90",
                ].join(" ")}
              >
                {isSelected && (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
