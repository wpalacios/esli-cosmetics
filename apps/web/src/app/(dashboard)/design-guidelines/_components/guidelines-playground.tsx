/* eslint-disable @next/next/no-img-element */
"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as AspectRatio from "@radix-ui/react-aspect-ratio";
import * as Avatar from "@radix-ui/react-avatar";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as HoverCard from "@radix-ui/react-hover-card";
import {
  BookmarkIcon,
  CheckCircledIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Cross2Icon,
  DotsHorizontalIcon,
  ExclamationTriangleIcon,
  GearIcon,
  HomeIcon,
  InfoCircledIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  PlusIcon,
  ReloadIcon,
  StarIcon,
  TrashIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import * as Label from "@radix-ui/react-label";
import * as Popover from "@radix-ui/react-popover";
import * as Progress from "@radix-ui/react-progress";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Select from "@radix-ui/react-select";
import * as Separator from "@radix-ui/react-separator";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as Toast from "@radix-ui/react-toast";
import * as Tooltip from "@radix-ui/react-tooltip";
import React, { useState } from "react";

import { useTranslation } from "@/lib/i18n/client";
import { Button, Card, Input } from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";

// Type assertions for Radix UI icons
const StarIconComponent = StarIcon as React.ComponentType<{
  className?: string;
}>;
const PlusIconComponent = PlusIcon as React.ComponentType<{
  className?: string;
}>;
const ChevronRightIconComponent = ChevronRightIcon as React.ComponentType<{
  className?: string;
}>;
const MagnifyingGlassIconComponent =
  MagnifyingGlassIcon as React.ComponentType<{ className?: string }>;
const GearIconComponent = GearIcon as React.ComponentType<{
  className?: string;
}>;
const Cross2IconComponent = Cross2Icon as React.ComponentType<{
  className?: string;
}>;
const UpdateIconComponent = UpdateIcon as React.ComponentType<{
  className?: string;
}>;
const CheckIconComponent = CheckIcon as React.ComponentType<{
  className?: string;
}>;
const ChevronDownIconComponent = ChevronDownIcon as React.ComponentType<{
  className?: string;
}>;
const DotsHorizontalIconComponent = DotsHorizontalIcon as React.ComponentType<{
  className?: string;
}>;
const PersonIconComponent = PersonIcon as React.ComponentType<{
  className?: string;
}>;
const InfoCircledIconComponent = InfoCircledIcon as React.ComponentType<{
  className?: string;
}>;
const CheckCircledIconComponent = CheckCircledIcon as React.ComponentType<{
  className?: string;
}>;
const ExclamationTriangleIconComponent =
  ExclamationTriangleIcon as React.ComponentType<{ className?: string }>;
const HomeIconComponent = HomeIcon as React.ComponentType<{
  className?: string;
}>;
const BookmarkIconComponent = BookmarkIcon as React.ComponentType<{
  className?: string;
}>;
const TrashIconComponent = TrashIcon as React.ComponentType<{
  className?: string;
}>;
const ReloadIconComponent = ReloadIcon as React.ComponentType<{
  className?: string;
}>;

export default function GuidelinesPlayground() {
  const { t } = useTranslation("es", "guidelines");
  const [toastOpen, setToastOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState("option1");
  const [sliderValue, setSliderValue] = useState([50]);
  const [progressValue, setProgressValue] = useState(75);
  const [segmentedValue, setSegmentedValue] = useState("inbox");

  return (
    <Toast.Provider swipeDirection="right">
      <Tooltip.Provider>
        <div className="min-h-screen bg-white">
          {/* Header */}
          <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
            <div className="mx-auto max-w-7xl px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-heading text-3xl font-bold text-neutral-900">
                    <span className="text-primary">Esli Cosmetics</span>{" "}
                    {t("title")}
                  </h1>
                  <p className="mt-2 text-neutral-600">{t("subtitle")}</p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="mx-auto max-w-7xl px-6 py-12">
            {/* Table of Contents */}
            <div className="mb-16">
              <h2 className="mb-6 font-heading text-2xl font-bold text-neutral-900">
                Components
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-4">
                {[
                  { name: "Buttons", id: "buttons" },
                  { name: "Forms", id: "forms" },
                  { name: "Selects", id: "selects" },
                  { name: "Avatars", id: "avatars" },
                  { name: "Tabs", id: "tabs" },
                  { name: "Accordion", id: "accordion" },
                  { name: "Dialogs", id: "dialogs" },
                  { name: "Badge", id: "badge" },
                  { name: "Callout", id: "callout" },
                  { name: "Progress", id: "progress" },
                  { name: "Slider", id: "slider" },
                  { name: "Radio", id: "radio" },
                  { name: "Context Menu", id: "context-menu" },
                  { name: "Segmented Control", id: "segmented-control" },
                  { name: "Separator", id: "separator" },
                  { name: "Table", id: "table" },
                  { name: "Spinner", id: "spinner" },
                  { name: "Skeleton", id: "skeleton" },
                  { name: "Hover Card", id: "hover-card" },
                  { name: "Popover", id: "popover" },
                  { name: "Aspect Ratio", id: "aspect-ratio" },
                  { name: "Scroll Area", id: "scroll-area" },
                  { name: "Text Fields", id: "text-fields" },
                  { name: "Toast", id: "toast" },
                  { name: "Tooltips", id: "tooltips" },
                ].map(section => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="hover:text-primary font-medium text-neutral-600 transition-colors"
                  >
                    {section.name}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-16">
              {/* Buttons Section */}
              <Section title="Buttons" id="buttons">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ComponentDemo title="Primary Buttons">
                    <div className="space-y-3">
                      <Button variant="primary">Primary Button</Button>
                      <Button variant="primary" disabled>
                        Disabled
                      </Button>
                      <Button
                        variant="primary"
                        rightIcon={<PlusIconComponent className="h-4 w-4" />}
                      >
                        With Icon
                      </Button>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Secondary Buttons">
                    <div className="space-y-3">
                      <Button variant="secondary">Secondary Button</Button>
                      <Button variant="secondary" disabled>
                        Disabled
                      </Button>
                      <Button
                        variant="secondary"
                        rightIcon={
                          <ChevronRightIconComponent className="h-4 w-4" />
                        }
                      >
                        With Icon
                      </Button>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Button Sizes">
                    <div className="space-y-3">
                      <Button variant="primary" size="sm">
                        Small
                      </Button>
                      <Button variant="primary">Medium (default)</Button>
                      <Button variant="primary" size="lg">
                        Large
                      </Button>
                    </div>
                  </ComponentDemo>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ComponentDemo title="Ghost Buttons">
                    <div className="space-y-3">
                      <Button variant="ghost">Ghost Button</Button>
                      <Button variant="ghost" disabled>
                        Disabled
                      </Button>
                      <Button
                        variant="ghost"
                        leftIcon={
                          <MagnifyingGlassIconComponent className="h-4 w-4" />
                        }
                      >
                        Search
                      </Button>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Icon Buttons">
                    <div className="flex space-x-3">
                      <Button
                        variant="primary"
                        size="sm"
                        className="h-10 w-10 p-0"
                      >
                        <PlusIconComponent className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0"
                      >
                        <GearIconComponent className="h-4 w-4" />
                      </Button>
                      <Button variant="error" size="sm" className="h-8 w-8 p-0">
                        <Cross2IconComponent className="h-3 w-3" />
                      </Button>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Loading States">
                    <div className="space-y-3">
                      <Button
                        variant="primary"
                        loading
                        loadingText="Loading..."
                      >
                        Loading...
                      </Button>
                      <Button
                        variant="secondary"
                        leftIcon={
                          <CheckIconComponent className="h-4 w-4 text-green-600" />
                        }
                      >
                        Success
                      </Button>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Form Elements Section */}
              <Section title="Form Elements" id="forms">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <ComponentDemo title="Inputs">
                    <div className="space-y-4">
                      <div>
                        <Label.Root
                          htmlFor="email"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Email
                        </Label.Root>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                        />
                      </div>
                      <div>
                        <Label.Root
                          htmlFor="password"
                          className="text-sm font-medium text-neutral-700"
                        >
                          Password
                        </Label.Root>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                        />
                      </div>
                      <div>
                        <Input
                          type="text"
                          placeholder="Disabled input"
                          disabled
                        />
                      </div>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Checkboxes">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Checkbox.Root
                          checked={checkboxChecked}
                          onCheckedChange={checked =>
                            setCheckboxChecked(checked === true)
                          }
                          className="checkbox-root"
                        >
                          <Checkbox.Indicator className="checkbox-indicator">
                            <CheckIconComponent className="h-3 w-3" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <Label.Root className="text-sm text-neutral-700">
                          Accept terms and conditions
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox.Root checked={true} className="checkbox-root">
                          <Checkbox.Indicator className="checkbox-indicator">
                            <CheckIconComponent className="h-3 w-3" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <Label.Root className="text-sm text-neutral-700">
                          Checked state
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox.Root
                          checked={false}
                          disabled
                          className="checkbox-root cursor-not-allowed opacity-50"
                        >
                          <Checkbox.Indicator className="checkbox-indicator">
                            <CheckIconComponent className="h-3 w-3" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <Label.Root className="text-sm text-neutral-400">
                          Disabled
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Checkbox.Root
                          checked={true}
                          disabled
                          className="checkbox-root cursor-not-allowed opacity-50"
                        >
                          <Checkbox.Indicator className="checkbox-indicator">
                            <CheckIconComponent className="h-3 w-3" />
                          </Checkbox.Indicator>
                        </Checkbox.Root>
                        <Label.Root className="text-sm text-neutral-400">
                          Disabled checked
                        </Label.Root>
                      </div>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Switches">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Switch.Root
                          checked={switchChecked}
                          onCheckedChange={setSwitchChecked}
                          className="switch-root"
                        >
                          <Switch.Thumb className="switch-thumb" />
                        </Switch.Root>
                        <Label.Root className="text-sm text-neutral-700">
                          Enable notifications
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Switch.Root checked={true} className="switch-root">
                          <Switch.Thumb className="switch-thumb" />
                        </Switch.Root>
                        <Label.Root className="text-sm text-neutral-700">
                          Always on
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Switch.Root checked={false} className="switch-root">
                          <Switch.Thumb className="switch-thumb" />
                        </Switch.Root>
                        <Label.Root className="text-sm text-neutral-700">
                          Always off
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Switch.Root
                          checked={false}
                          disabled
                          className="switch-root cursor-not-allowed opacity-50"
                        >
                          <Switch.Thumb className="switch-thumb" />
                        </Switch.Root>
                        <Label.Root className="text-sm text-neutral-400">
                          Disabled switch
                        </Label.Root>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Switch.Root
                          checked={true}
                          disabled
                          className="switch-root cursor-not-allowed opacity-50"
                        >
                          <Switch.Thumb className="switch-thumb" />
                        </Switch.Root>
                        <Label.Root className="text-sm text-neutral-400">
                          Disabled on
                        </Label.Root>
                      </div>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Select & Dropdowns Section */}
              <Section title="Selects & Dropdowns" id="selects">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <ComponentDemo title="Select">
                    <Select.Root>
                      <Select.Trigger className="focus:border-primary focus:ring-primary inline-flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-20">
                        <Select.Value placeholder="Choose a framework..." />
                        <Select.Icon>
                          <ChevronDownIconComponent className="h-4 w-4" />
                        </Select.Icon>
                      </Select.Trigger>
                      <Select.Portal>
                        <Select.Content className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                          <Select.Viewport className="p-1">
                            <SelectItem value="next">Next.js</SelectItem>
                            <SelectItem value="react">React</SelectItem>
                            <SelectItem value="vue">Vue</SelectItem>
                            <SelectItem value="svelte">Svelte</SelectItem>
                          </Select.Viewport>
                        </Select.Content>
                      </Select.Portal>
                    </Select.Root>
                  </ComponentDemo>

                  <ComponentDemo title="Dropdown Menu">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button
                          variant="secondary"
                          rightIcon={
                            <DotsHorizontalIconComponent className="h-4 w-4" />
                          }
                        >
                          Options
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          className="min-w-[200px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg"
                          sideOffset={5}
                        >
                          <DropdownMenu.Item className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none">
                            <PersonIconComponent className="mr-2 h-4 w-4" />
                            Profile
                          </DropdownMenu.Item>
                          <DropdownMenu.Item className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none">
                            Settings
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
                          <DropdownMenu.Item className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50">
                            Logout
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Avatars Section */}
              <Section title="Avatars" id="avatars">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ComponentDemo title="Sizes">
                    <div className="flex items-center space-x-4">
                      <Avatar.Root className="bg-primary inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
                        <Avatar.Image
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                          alt="Avatar"
                        />
                        <Avatar.Fallback className="text-xs font-medium text-white">
                          JD
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <Avatar.Root className="bg-primary inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                        <Avatar.Image
                          src="https://images.unsplash.com/photo-1494790108755-2616b612b647?w=100&h=100&fit=crop&crop=face"
                          alt="Avatar"
                        />
                        <Avatar.Fallback className="text-sm font-medium text-white">
                          AS
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <Avatar.Root className="bg-primary inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full">
                        <Avatar.Fallback className="font-medium text-white">
                          ES
                        </Avatar.Fallback>
                      </Avatar.Root>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="With Status">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <Avatar.Root className="bg-primary inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                          <Avatar.Image
                            src="https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop&crop=face"
                            alt="Avatar"
                          />
                          <Avatar.Fallback className="text-sm font-medium text-white">
                            JD
                          </Avatar.Fallback>
                        </Avatar.Root>
                        <div className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                      </div>
                      <div className="relative">
                        <Avatar.Root className="bg-primary inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                          <Avatar.Image
                            src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face"
                            alt="Avatar"
                          />
                          <Avatar.Fallback className="text-sm font-medium text-white">
                            ML
                          </Avatar.Fallback>
                        </Avatar.Root>
                        <div className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-white bg-neutral-400" />
                      </div>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="Fallbacks">
                    <div className="flex items-center space-x-4">
                      <Avatar.Root className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-primary">
                        <Avatar.Fallback className="text-sm font-medium text-white">
                          EC
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <Avatar.Root className="bg-secondary inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
                        <Avatar.Fallback className="text-sm font-medium text-white">
                          UI
                        </Avatar.Fallback>
                      </Avatar.Root>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Tabs Section */}
              <Section title="Tabs" id="tabs">
                <ComponentDemo title="Tab Navigation">
                  <Tabs.Root defaultValue="account" className="w-full">
                    <Tabs.List className="inline-flex h-12 items-center justify-center rounded-xl bg-neutral-100 p-1">
                      <Tabs.Trigger
                        value="account"
                        className="focus:ring-primary data-[state=active]:text-primary inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-20 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >
                        Account
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        value="documents"
                        className="focus:ring-primary data-[state=active]:text-primary inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-20 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >
                        Documents
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        value="settings"
                        className="focus:ring-primary data-[state=active]:text-primary inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-opacity-20 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >
                        Settings
                      </Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="account" className="mt-6">
                      <Card>
                        <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                          Account Settings
                        </h3>
                        <p className="text-neutral-600">
                          Make changes to your account here. Click save when
                          you&apos;re done.
                        </p>
                      </Card>
                    </Tabs.Content>
                    <Tabs.Content value="documents" className="mt-6">
                      <Card>
                        <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                          Documents
                        </h3>
                        <p className="text-neutral-600">
                          Access and manage your documents here.
                        </p>
                      </Card>
                    </Tabs.Content>
                    <Tabs.Content value="settings" className="mt-6">
                      <Card>
                        <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                          Settings
                        </h3>
                        <p className="text-neutral-600">
                          Configure your preferences and settings.
                        </p>
                      </Card>
                    </Tabs.Content>
                  </Tabs.Root>
                </ComponentDemo>
              </Section>

              {/* Accordion Section */}
              <Section title="Accordion" id="accordion">
                <ComponentDemo title="FAQ Accordion">
                  <Accordion.Root
                    type="single"
                    collapsible
                    className="w-full space-y-2"
                  >
                    <AccordionItem value="item-1">
                      <AccordionTrigger>
                        ¿Cómo funciona el sistema de inventario?
                      </AccordionTrigger>
                      <AccordionContent>
                        El sistema de inventario te permite gestionar productos,
                        variantes, niveles de stock y movimientos de manera
                        automática. Incluye alertas de stock bajo y códigos de
                        barras para facilitar el manejo.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>
                        ¿Puedo personalizar los reportes?
                      </AccordionTrigger>
                      <AccordionContent>
                        Sí, puedes crear reportes personalizados con los datos
                        que necesites. El sistema incluye dashboards en tiempo
                        real y métricas de rendimiento del negocio.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>
                        ¿Qué métodos de pago acepta el POS?
                      </AccordionTrigger>
                      <AccordionContent>
                        El sistema POS acepta múltiples formas de pago
                        incluyendo efectivo, tarjetas de crédito/débito, y pagos
                        digitales. También maneja descuentos y promociones.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion.Root>
                </ComponentDemo>
              </Section>

              {/* Dialogs Section */}
              <Section title="Dialogs & Modals" id="dialogs">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Dialog">
                    <Dialog.Root>
                      <Dialog.Trigger asChild>
                        <Button variant="primary">Open Dialog</Button>
                      </Dialog.Trigger>
                      <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                        <Dialog.Content className="fixed left-1/2 top-1/2 mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-2xl bg-white p-6 shadow-xl">
                          <Dialog.Title className="mb-2 text-lg font-semibold text-neutral-900">
                            Edit Profile
                          </Dialog.Title>
                          <Dialog.Description className="mb-6 text-neutral-600">
                            Make changes to your profile here. Click save when
                            you&apos;re done.
                          </Dialog.Description>
                          <div className="space-y-4">
                            <div>
                              <Label.Root className="text-sm font-medium text-neutral-700">
                                Name
                              </Label.Root>
                              <Input defaultValue="Pedro Duarte" />
                            </div>
                            <div>
                              <Label.Root className="text-sm font-medium text-neutral-700">
                                Username
                              </Label.Root>
                              <Input defaultValue="@peduarte" />
                            </div>
                          </div>
                          <div className="mt-6 flex justify-end space-x-3">
                            <Dialog.Close asChild>
                              <Button variant="ghost">Cancel</Button>
                            </Dialog.Close>
                            <Dialog.Close asChild>
                              <Button variant="primary">Save changes</Button>
                            </Dialog.Close>
                          </div>
                        </Dialog.Content>
                      </Dialog.Portal>
                    </Dialog.Root>
                  </ComponentDemo>

                  <ComponentDemo title="Alert Dialog">
                    <AlertDialog.Root>
                      <AlertDialog.Trigger asChild>
                        <Button variant="error">Delete Item</Button>
                      </AlertDialog.Trigger>
                      <AlertDialog.Portal>
                        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                        <AlertDialog.Content className="fixed left-1/2 top-1/2 mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-2xl bg-white p-6 shadow-xl">
                          <AlertDialog.Title className="mb-2 text-lg font-semibold text-neutral-900">
                            Are you absolutely sure?
                          </AlertDialog.Title>
                          <AlertDialog.Description className="mb-6 text-neutral-600">
                            This action cannot be undone. This will permanently
                            delete the item and remove the data from our
                            servers.
                          </AlertDialog.Description>
                          <div className="flex justify-end space-x-3">
                            <AlertDialog.Cancel asChild>
                              <Button variant="ghost">Cancel</Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action asChild>
                              <Button variant="error">Yes, delete</Button>
                            </AlertDialog.Action>
                          </div>
                        </AlertDialog.Content>
                      </AlertDialog.Portal>
                    </AlertDialog.Root>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Badge Section */}
              <Section title="Badge" id="badge">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ComponentDemo title="Variants">
                    <div className="flex flex-wrap gap-3">
                      <span className="bg-primary inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium text-white">
                        Solid
                      </span>
                      <span className="bg-primary/10 border-primary/20 inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium text-primary-600">
                        Soft
                      </span>
                      <span className="text-primary border-primary inline-flex items-center rounded-lg border bg-white px-2 py-1 text-xs font-medium">
                        Outline
                      </span>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Sizes">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="bg-primary inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white">
                        Small
                      </span>
                      <span className="bg-primary inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium text-white">
                        Medium
                      </span>
                      <span className="bg-primary inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-white">
                        Large
                      </span>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Colors">
                    <div className="flex flex-wrap gap-3">
                      <span className="inline-flex items-center rounded-lg bg-green-500 px-2 py-1 text-xs font-medium text-white">
                        Success
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-orange-500 px-2 py-1 text-xs font-medium text-white">
                        Warning
                      </span>
                      <span className="inline-flex items-center rounded-lg bg-red-500 px-2 py-1 text-xs font-medium text-white">
                        Error
                      </span>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Callout Section */}
              <Section title="Callout" id="callout">
                <div className="grid grid-cols-1 gap-6">
                  <ComponentDemo title="Variants">
                    <div className="space-y-4">
                      <div className="flex items-start rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <InfoCircledIconComponent className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">
                            Information
                          </p>
                          <p className="mt-1 text-sm text-blue-700">
                            This is an informational callout with helpful
                            details.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start rounded-xl border border-green-200 bg-green-50 p-4">
                        <CheckCircledIconComponent className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            Success
                          </p>
                          <p className="mt-1 text-sm text-green-700">
                            Operation completed successfully!
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start rounded-xl border border-orange-200 bg-orange-50 p-4">
                        <ExclamationTriangleIconComponent className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-orange-800">
                            Warning
                          </p>
                          <p className="mt-1 text-sm text-orange-700">
                            Please review this important information.
                          </p>
                        </div>
                      </div>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Progress Section */}
              <Section title="Progress" id="progress">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Progress Bar">
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex justify-between text-sm text-neutral-600">
                          <span>Progress</span>
                          <span>{progressValue}%</span>
                        </div>
                        <Progress.Root className="progress-root progress-md">
                          <Progress.Indicator
                            className="progress-indicator"
                            style={{
                              transform: `translateX(-${100 - progressValue}%)`,
                            }}
                          />
                        </Progress.Root>
                      </div>
                      <div>
                        <div className="mb-2 flex justify-between text-sm text-neutral-600">
                          <span>Loading</span>
                          <span>33%</span>
                        </div>
                        <Progress.Root className="progress-root progress-md">
                          <Progress.Indicator
                            className="progress-indicator"
                            style={{ transform: `translateX(-67%)` }}
                          />
                        </Progress.Root>
                      </div>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Different Sizes">
                    <div className="space-y-4">
                      <div>
                        <Label.Root className="mb-2 block text-xs text-neutral-500">
                          Small (h-1)
                        </Label.Root>
                        <Progress.Root className="progress-root progress-sm">
                          <Progress.Indicator
                            className="progress-indicator"
                            style={{ transform: `translateX(-20%)` }}
                          />
                        </Progress.Root>
                      </div>
                      <div>
                        <Label.Root className="mb-2 block text-xs text-neutral-500">
                          Medium (h-2)
                        </Label.Root>
                        <Progress.Root className="progress-root progress-md">
                          <Progress.Indicator
                            className="progress-indicator"
                            style={{ transform: `translateX(-60%)` }}
                          />
                        </Progress.Root>
                      </div>
                      <div>
                        <Label.Root className="mb-2 block text-xs text-neutral-500">
                          Large (h-3)
                        </Label.Root>
                        <Progress.Root className="progress-root progress-lg">
                          <Progress.Indicator
                            className="progress-indicator"
                            style={{ transform: `translateX(-90%)` }}
                          />
                        </Progress.Root>
                      </div>
                      <div>
                        <Label.Root className="mb-2 block text-xs text-neutral-500">
                          Extra Large (h-4)
                        </Label.Root>
                        <Progress.Root className="progress-root progress-xl">
                          <Progress.Indicator
                            className="progress-indicator"
                            style={{ transform: `translateX(-40%)` }}
                          />
                        </Progress.Root>
                      </div>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Slider Section */}
              <Section title="Slider" id="slider">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Range Slider">
                    <div className="space-y-6">
                      <div>
                        <Label.Root className="mb-3 block text-sm font-medium text-neutral-700">
                          Value: {sliderValue[0]}
                        </Label.Root>
                        <Slider.Root
                          value={sliderValue}
                          onValueChange={setSliderValue}
                          max={100}
                          step={1}
                          className="slider-root"
                        >
                          <Slider.Track className="slider-track">
                            <Slider.Range className="slider-range" />
                          </Slider.Track>
                          <Slider.Thumb className="slider-thumb" />
                        </Slider.Root>
                      </div>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Disabled State">
                    <div className="space-y-6">
                      <div>
                        <Label.Root className="mb-3 block text-sm font-medium text-neutral-400">
                          Disabled: 30
                        </Label.Root>
                        <Slider.Root
                          value={[30]}
                          max={100}
                          step={1}
                          disabled
                          className="slider-root opacity-50"
                        >
                          <Slider.Track className="slider-track">
                            <Slider.Range className="absolute h-full rounded-full bg-neutral-400" />
                          </Slider.Track>
                          <Slider.Thumb className="slider-thumb" />
                        </Slider.Root>
                      </div>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Radio Group Section */}
              <Section title="Radio Group" id="radio">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Basic Radio Group">
                    <RadioGroup.Root
                      value={radioValue}
                      onValueChange={setRadioValue}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-3">
                        <RadioGroup.Item value="option1" className="radio-item">
                          <RadioGroup.Indicator className="radio-indicator" />
                        </RadioGroup.Item>
                        <Label.Root className="text-sm text-neutral-700">
                          Option 1
                        </Label.Root>
                      </div>
                      <div className="flex items-center space-x-3">
                        <RadioGroup.Item value="option2" className="radio-item">
                          <RadioGroup.Indicator className="radio-indicator" />
                        </RadioGroup.Item>
                        <Label.Root className="text-sm text-neutral-700">
                          Option 2
                        </Label.Root>
                      </div>
                      <div className="flex items-center space-x-3">
                        <RadioGroup.Item value="option3" className="radio-item">
                          <RadioGroup.Indicator className="radio-indicator" />
                        </RadioGroup.Item>
                        <Label.Root className="text-sm text-neutral-700">
                          Option 3
                        </Label.Root>
                      </div>
                    </RadioGroup.Root>
                  </ComponentDemo>

                  <ComponentDemo title="Radio Cards">
                    <RadioGroup.Root
                      value={radioValue}
                      onValueChange={setRadioValue}
                      className="space-y-2"
                    >
                      <div className="flex items-center">
                        <RadioGroup.Item
                          value="card1"
                          id="card1"
                          className="peer sr-only"
                        />
                        <Label.Root
                          htmlFor="card1"
                          className="peer-checked:border-primary peer-checked:bg-primary/5 flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center space-x-3">
                            <HomeIconComponent className="h-5 w-5" />
                            <span>Home Dashboard</span>
                          </div>
                        </Label.Root>
                      </div>
                      <div className="flex items-center">
                        <RadioGroup.Item
                          value="card2"
                          id="card2"
                          className="peer sr-only"
                        />
                        <Label.Root
                          htmlFor="card2"
                          className="peer-checked:border-primary peer-checked:bg-primary/5 flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-800"
                        >
                          <div className="flex items-center space-x-3">
                            <GearIconComponent className="h-5 w-5" />
                            <span>Settings Panel</span>
                          </div>
                        </Label.Root>
                      </div>
                    </RadioGroup.Root>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Context Menu Section */}
              <Section title="Context Menu" id="context-menu">
                <ComponentDemo title="Right-click Context Menu">
                  <ContextMenu.Root>
                    <ContextMenu.Trigger className="flex h-40 w-80 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-neutral-600 hover:bg-neutral-100">
                      Right-click here for context menu
                    </ContextMenu.Trigger>
                    <ContextMenu.Portal>
                      <ContextMenu.Content className="min-w-[200px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                        <ContextMenu.Item className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none">
                          <BookmarkIconComponent className="mr-2 h-4 w-4" />
                          Add Bookmark
                        </ContextMenu.Item>
                        <ContextMenu.Item className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none">
                          Copy Link
                        </ContextMenu.Item>
                        <ContextMenu.Separator className="my-1 h-px bg-neutral-200" />
                        <ContextMenu.Item className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50">
                          <TrashIconComponent className="mr-2 h-4 w-4" />
                          Delete
                        </ContextMenu.Item>
                      </ContextMenu.Content>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                </ComponentDemo>
              </Section>

              {/* Segmented Control Section */}
              <Section title="Segmented Control" id="segmented-control">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Basic Segmented Control">
                    <div className="segmented-root">
                      <button
                        className={cn(
                          "segmented-item",
                          segmentedValue === "inbox"
                            ? "segmented-item-active"
                            : "segmented-item-inactive"
                        )}
                        onClick={() => setSegmentedValue("inbox")}
                      >
                        Inbox
                      </button>
                      <button
                        className={cn(
                          "segmented-item",
                          segmentedValue === "sent"
                            ? "segmented-item-active"
                            : "segmented-item-inactive"
                        )}
                        onClick={() => setSegmentedValue("sent")}
                      >
                        Sent
                      </button>
                      <button
                        className={cn(
                          "segmented-item",
                          segmentedValue === "drafts"
                            ? "segmented-item-active"
                            : "segmented-item-inactive"
                        )}
                        onClick={() => setSegmentedValue("drafts")}
                      >
                        Drafts
                      </button>
                    </div>
                  </ComponentDemo>

                  <ComponentDemo title="With Icons">
                    <div className="segmented-root">
                      <button
                        className={cn(
                          "segmented-item",
                          segmentedValue === "home"
                            ? "segmented-item-active"
                            : "segmented-item-inactive"
                        )}
                        onClick={() => setSegmentedValue("home")}
                      >
                        <HomeIconComponent className="mr-1.5 h-4 w-4" />
                        Home
                      </button>
                      <button
                        className={cn(
                          "segmented-item",
                          segmentedValue === "settings"
                            ? "segmented-item-active"
                            : "segmented-item-inactive"
                        )}
                        onClick={() => setSegmentedValue("settings")}
                      >
                        <GearIconComponent className="mr-1.5 h-4 w-4" />
                        Settings
                      </button>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Separator Section */}
              <Section title="Separator" id="separator">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Horizontal">
                    <div className="space-y-4">
                      <p className="text-sm text-neutral-600">
                        Content above separator
                      </p>
                      <Separator.Root className="h-px w-full bg-neutral-200" />
                      <p className="text-sm text-neutral-600">
                        Content below separator
                      </p>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Vertical">
                    <div className="flex h-20 items-center space-x-4">
                      <p className="text-sm text-neutral-600">Left content</p>
                      <Separator.Root className="h-full w-px bg-neutral-200" />
                      <p className="text-sm text-neutral-600">Right content</p>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Table Section */}
              <Section title="Table" id="table">
                <div className="grid grid-cols-1 gap-6">
                  <ComponentDemo title="Data Table">
                    <div className="overflow-hidden rounded-xl border border-neutral-200">
                      <table className="w-full">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                              Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                              Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          <tr className="hover:bg-neutral-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">
                              Sarah Wilson
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                              sarah@example.com
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                              Admin
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="inline-flex items-center rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                Active
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">
                              John Doe
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                              john@example.com
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                              User
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="inline-flex items-center rounded-lg bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
                                Pending
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-neutral-900">
                              Maria Garcia
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                              maria@example.com
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-neutral-600">
                              Manager
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="inline-flex items-center rounded-lg bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                Active
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Spinner Section */}
              <Section title="Spinner" id="spinner">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ComponentDemo title="Sizes">
                    <div className="flex items-center space-x-6">
                      <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                      <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                      <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Colors">
                    <div className="flex items-center space-x-6">
                      <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Button with Spinner">
                    <div className="space-y-3">
                      <Button
                        variant="primary"
                        loading
                        loadingText="Loading..."
                      >
                        Loading...
                      </Button>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Skeleton Section */}
              <Section title="Skeleton" id="skeleton">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Text Skeleton">
                    <div className="space-y-3">
                      <div className="animate-pulse">
                        <div className="h-4 w-3/4 rounded-lg bg-neutral-200" />
                        <div className="mt-3 space-y-2">
                          <div className="h-3 rounded-lg bg-neutral-200" />
                          <div className="h-3 w-5/6 rounded-lg bg-neutral-200" />
                          <div className="h-3 w-4/6 rounded-lg bg-neutral-200" />
                        </div>
                      </div>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Card Skeleton">
                    <Card>
                      <div className="animate-pulse">
                        <div className="flex space-x-4">
                          <div className="h-12 w-12 rounded-full bg-neutral-200" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 w-3/4 rounded-lg bg-neutral-200" />
                            <div className="h-3 w-1/2 rounded-lg bg-neutral-200" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Hover Card Section */}
              <Section title="Hover Card" id="hover-card">
                <ComponentDemo title="Profile Hover Card">
                  <HoverCard.Root>
                    <HoverCard.Trigger asChild>
                      <a
                        className="text-primary inline-flex cursor-pointer items-center space-x-2 hover:text-primary-600"
                        href="#"
                      >
                        <Avatar.Root className="bg-primary inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                          <Avatar.Image
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                            alt="Avatar"
                          />
                          <Avatar.Fallback className="text-xs font-medium text-white">
                            JD
                          </Avatar.Fallback>
                        </Avatar.Root>
                        <span className="text-sm">@johndoe</span>
                      </a>
                    </HoverCard.Trigger>
                    <HoverCard.Portal>
                      <HoverCard.Content
                        className="w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg"
                        sideOffset={5}
                      >
                        <div className="flex space-x-4">
                          <Avatar.Root className="bg-primary inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full">
                            <Avatar.Image
                              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                              alt="Avatar"
                            />
                            <Avatar.Fallback className="font-medium text-white">
                              JD
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-neutral-900">
                              John Doe
                            </h4>
                            <p className="text-sm text-neutral-600">@johndoe</p>
                            <p className="mt-2 text-sm text-neutral-600">
                              Frontend developer passionate about creating
                              beautiful user experiences.
                            </p>
                            <div className="mt-3 flex space-x-4 text-xs text-neutral-500">
                              <span>
                                <strong className="text-neutral-900">
                                  125
                                </strong>{" "}
                                Following
                              </span>
                              <span>
                                <strong className="text-neutral-900">
                                  2.5k
                                </strong>{" "}
                                Followers
                              </span>
                            </div>
                          </div>
                        </div>
                        <HoverCard.Arrow className="fill-white" />
                      </HoverCard.Content>
                    </HoverCard.Portal>
                  </HoverCard.Root>
                </ComponentDemo>
              </Section>

              {/* Popover Section */}
              <Section title="Popover" id="popover">
                <ComponentDemo title="Settings Popover">
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <Button
                        variant="secondary"
                        leftIcon={<GearIconComponent className="h-4 w-4" />}
                      >
                        Settings
                      </Button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg"
                        sideOffset={5}
                      >
                        <div className="space-y-4">
                          <div>
                            <h3 className="mb-3 text-sm font-medium text-neutral-900">
                              Dimensions
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label.Root className="text-xs font-medium text-neutral-700">
                                  Width
                                </Label.Root>
                                <input
                                  className="focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2"
                                  defaultValue="100%"
                                />
                              </div>
                              <div>
                                <Label.Root className="text-xs font-medium text-neutral-700">
                                  Max. width
                                </Label.Root>
                                <input
                                  className="focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2"
                                  defaultValue="300px"
                                />
                              </div>
                            </div>
                          </div>
                          <div>
                            <Label.Root className="text-xs font-medium text-neutral-700">
                              Height
                            </Label.Root>
                            <input
                              className="focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2"
                              defaultValue="25px"
                            />
                          </div>
                        </div>
                        <Popover.Arrow className="fill-white" />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </ComponentDemo>
              </Section>

              {/* Aspect Ratio Section */}
              <Section title="Aspect Ratio" id="aspect-ratio">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <ComponentDemo title="16:9">
                    <AspectRatio.Root
                      ratio={16 / 9}
                      className="overflow-hidden rounded-xl bg-neutral-200"
                    >
                      <img
                        className="h-full w-full object-cover"
                        src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&h=450&fit=crop"
                        alt="Landscape"
                      />
                    </AspectRatio.Root>
                  </ComponentDemo>
                  <ComponentDemo title="4:3">
                    <AspectRatio.Root
                      ratio={4 / 3}
                      className="overflow-hidden rounded-xl bg-neutral-200"
                    >
                      <img
                        className="h-full w-full object-cover"
                        src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop"
                        alt="Mountain"
                      />
                    </AspectRatio.Root>
                  </ComponentDemo>
                  <ComponentDemo title="1:1">
                    <AspectRatio.Root
                      ratio={1}
                      className="overflow-hidden rounded-xl bg-neutral-200"
                    >
                      <img
                        className="h-full w-full object-cover"
                        src="https://images.unsplash.com/photo-1494790108755-2616b612b647?w=400&h=400&fit=crop&crop=face"
                        alt="Portrait"
                      />
                    </AspectRatio.Root>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Scroll Area Section */}
              <Section title="Scroll Area" id="scroll-area">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Vertical Scrolling">
                    <ScrollArea.Root className="h-64 w-full overflow-hidden rounded-xl border border-neutral-200">
                      <ScrollArea.Viewport className="h-full w-full rounded">
                        <div className="p-4 text-sm text-neutral-600">
                          <p className="mb-4">
                            <strong className="text-neutral-900">
                              The Principles of Beautiful Typography
                            </strong>
                          </p>
                          <p className="mb-4">
                            Typography is the art and technique of arranging
                            type to make written language legible, readable and
                            appealing when displayed. The arrangement of type
                            involves selecting typefaces, point sizes, line
                            lengths, line-spacing, and letter-spacing, and
                            adjusting the space between pairs of letters.
                          </p>
                          <p className="mb-4">
                            The goal of typography is to relate font size, line
                            height, and line width in a proportional way that
                            maximizes beauty and makes reading easier and more
                            pleasant. The question is: What proportion(s) will
                            give us the best results?
                          </p>
                          <p className="mb-4">
                            The golden ratio is often observed in nature where
                            beauty and utility intersect; perhaps we can use
                            this divine proportion to enhance these attributes
                            in our typography.
                          </p>
                          <p className="mb-4">
                            Good typography establishes a strong visual
                            hierarchy, provides a sense of structure and
                            organization to content, and creates an overall
                            aesthetic that supports the message being
                            communicated.
                          </p>
                        </div>
                      </ScrollArea.Viewport>
                      <ScrollArea.Scrollbar
                        className="duration-160 flex touch-none select-none bg-neutral-100 p-0.5 transition-colors ease-out hover:bg-neutral-200 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col"
                        orientation="vertical"
                      >
                        <ScrollArea.Thumb className="relative flex-1 rounded-full bg-neutral-400 before:absolute before:left-1/2 before:top-1/2 before:h-full before:min-h-[44px] before:w-full before:min-w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']" />
                      </ScrollArea.Scrollbar>
                      <ScrollArea.Corner className="bg-neutral-100" />
                    </ScrollArea.Root>
                  </ComponentDemo>

                  <ComponentDemo title="Tag List">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-neutral-700">
                        Popular Tags
                      </h4>
                      <ScrollArea.Root className="h-32 w-full overflow-hidden rounded-xl border border-neutral-200">
                        <ScrollArea.Viewport className="h-full w-full rounded">
                          <div className="flex flex-wrap gap-2 p-4">
                            {[
                              "React",
                              "TypeScript",
                              "Next.js",
                              "Tailwind CSS",
                              "Node.js",
                              "GraphQL",
                              "MongoDB",
                              "PostgreSQL",
                              "Docker",
                              "Kubernetes",
                              "AWS",
                              "Vercel",
                              "Prisma",
                              "tRPC",
                              "Zod",
                            ].map(tag => (
                              <span
                                key={tag}
                                className="inline-flex cursor-pointer items-center rounded-lg bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar
                          className="duration-160 flex touch-none select-none bg-neutral-100 p-0.5 transition-colors ease-out hover:bg-neutral-200 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col"
                          orientation="vertical"
                        >
                          <ScrollArea.Thumb className="relative flex-1 rounded-full bg-neutral-400 before:absolute before:left-1/2 before:top-1/2 before:h-full before:min-h-[44px] before:w-full before:min-w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']" />
                        </ScrollArea.Scrollbar>
                      </ScrollArea.Root>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Text Field & Text Area Section */}
              <Section title="Text Fields & Areas" id="text-fields">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <ComponentDemo title="Text Fields">
                    <div className="space-y-4">
                      <div>
                        <Label.Root className="text-sm font-medium text-neutral-700">
                          Name
                        </Label.Root>
                        <Input placeholder="Enter your name" />
                      </div>
                      <div>
                        <Label.Root className="text-sm font-medium text-neutral-700">
                          Email
                        </Label.Root>
                        <Input type="email" placeholder="john@example.com" />
                      </div>
                      <div>
                        <Label.Root className="text-sm font-medium text-neutral-700">
                          Search
                        </Label.Root>
                        <Input
                          placeholder="Search..."
                          leftIcon={
                            <MagnifyingGlassIconComponent className="h-4 w-4 text-neutral-400" />
                          }
                        />
                      </div>
                    </div>
                  </ComponentDemo>
                  <ComponentDemo title="Text Areas">
                    <div className="space-y-4">
                      <div>
                        <Label.Root className="text-sm font-medium text-neutral-700">
                          Message
                        </Label.Root>
                        <textarea
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm placeholder:text-neutral-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-20 disabled:cursor-not-allowed disabled:opacity-50"
                          rows={4}
                          placeholder="Write your message here..."
                        />
                      </div>
                      <div>
                        <Label.Root className="text-sm font-medium text-neutral-700">
                          Comments
                        </Label.Root>
                        <textarea
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm placeholder:text-neutral-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-opacity-20 disabled:cursor-not-allowed disabled:opacity-50"
                          rows={6}
                          placeholder="Add your comments..."
                        />
                      </div>
                    </div>
                  </ComponentDemo>
                </div>
              </Section>

              {/* Tooltips Section */}
              <Section title="Tooltips" id="tooltips">
                <ComponentDemo title="Tooltip Examples">
                  <div className="flex space-x-6">
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <Button variant="secondary">Hover me</Button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg"
                          sideOffset={5}
                        >
                          This is a tooltip
                          <Tooltip.Arrow className="fill-neutral-900" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-10 w-10 rounded-full p-0"
                        >
                          <PlusIconComponent className="h-4 w-4" />
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg"
                          sideOffset={5}
                        >
                          Add new item
                          <Tooltip.Arrow className="fill-neutral-900" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </div>
                </ComponentDemo>
              </Section>

              {/* Toast Section */}
              <Section title="Toast Notifications" id="toast">
                <ComponentDemo title="Toast Examples">
                  <div className="flex space-x-3">
                    <Button
                      variant="primary"
                      onClick={() => setToastOpen(true)}
                    >
                      Show Success Toast
                    </Button>
                  </div>
                </ComponentDemo>
              </Section>
            </div>
          </main>
        </div>

        {/* Toast Container */}
        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          className="rounded-xl border border-green-200 bg-green-50 p-4 shadow-lg"
        >
          <Toast.Title className="font-medium text-green-800">
            Success!
          </Toast.Title>
          <Toast.Description className="mt-1 text-sm text-green-600">
            Your changes have been saved successfully.
          </Toast.Description>
          <Toast.Close className="absolute right-3 top-3 text-green-600 hover:text-green-800">
            <Cross2IconComponent className="h-4 w-4" />
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport className="fixed bottom-0 right-0 z-50 m-0 flex w-[390px] max-w-[100vw] list-none flex-col gap-2 p-6 outline-none" />
      </Tooltip.Provider>
    </Toast.Provider>
  );
}

// Helper Components
function Section({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-8 flex items-center space-x-4">
        <h2 className="font-heading text-2xl font-bold text-neutral-900">
          {title}
        </h2>
        <Separator.Root className="h-px flex-1 bg-neutral-200" />
      </div>
      {children}
    </section>
  );
}

function ComponentDemo({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-neutral-700">{title}</h3>
      {children}
    </Card>
  );
}

function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Select.Item
      value={value}
      className="hover:bg-primary/10 focus:bg-primary/10 relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none"
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3">
        <CheckIconComponent className="h-4 w-4" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

function AccordionItem({
  children,
  value,
  ...props
}: {
  children: React.ReactNode;
  value: string;
  [key: string]: any;
}) {
  return (
    <Accordion.Item
      value={value}
      className="overflow-hidden rounded-xl border border-neutral-200"
      {...props}
    >
      {children}
    </Accordion.Item>
  );
}

function AccordionTrigger({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <Accordion.Header className="flex">
      <Accordion.Trigger
        className="group flex flex-1 items-center justify-between px-4 py-3 text-left font-medium outline-none hover:bg-neutral-50 focus:bg-neutral-50"
        {...props}
      >
        {children}
        <ChevronDownIconComponent className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </Accordion.Trigger>
    </Accordion.Header>
  );
}

function AccordionContent({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <Accordion.Content
      className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden"
      {...props}
    >
      <div className="px-4 pb-4 text-neutral-600">{children}</div>
    </Accordion.Content>
  );
}
