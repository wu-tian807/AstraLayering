$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]

public static class UpscaleVulkanProbe
{
    [StructLayout(LayoutKind.Sequential)]
    private struct QueueFamily
    {
        public uint Flags, Count, TimestampBits, GranularityWidth, GranularityHeight, GranularityDepth;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct InstanceCreateInfo
    {
        public uint Type;
        public IntPtr Next;
        public uint Flags;
        public IntPtr Application;
        public uint LayerCount;
        public IntPtr Layers;
        public uint ExtensionCount;
        public IntPtr Extensions;
    }

    [DllImport("vulkan-1.dll")]
    private static extern int vkCreateInstance(ref InstanceCreateInfo info, IntPtr allocator, out IntPtr instance);
    [DllImport("vulkan-1.dll")]
    private static extern void vkDestroyInstance(IntPtr instance, IntPtr allocator);
    [DllImport("vulkan-1.dll")]
    private static extern int vkEnumeratePhysicalDevices(IntPtr instance, ref uint count, [Out] IntPtr[] devices);
    [DllImport("vulkan-1.dll")]
    private static extern void vkGetPhysicalDeviceProperties(IntPtr device, IntPtr properties);
    [DllImport("vulkan-1.dll")]
    private static extern void vkGetPhysicalDeviceQueueFamilyProperties(IntPtr device, ref uint count, [Out] QueueFamily[] queues);

    private static bool HasComputeQueue(IntPtr device)
    {
        const uint computeBit = 0x00000002; // VK_QUEUE_COMPUTE_BIT
        uint count = 0;
        vkGetPhysicalDeviceQueueFamilyProperties(device, ref count, null);
        if (count == 0) return false;
        var queues = new QueueFamily[count];
        vkGetPhysicalDeviceQueueFamilyProperties(device, ref count, queues);
        for (var i = 0; i < count; i++)
            if (queues[i].Count > 0 && (queues[i].Flags & computeBit) != 0) return true;
        return false;
    }

    public static bool HasCompatibleGpu()
    {
        IntPtr instance = IntPtr.Zero;
        try
        {
            // Null application info requests core Vulkan 1.0 for enumeration.
            var info = new InstanceCreateInfo { Type = 1 };
            if (vkCreateInstance(ref info, IntPtr.Zero, out instance) != 0) return false;

            uint count = 0;
            if (vkEnumeratePhysicalDevices(instance, ref count, null) != 0 || count == 0) return false;
            var devices = new IntPtr[count];
            if (vkEnumeratePhysicalDevices(instance, ref count, devices) != 0) return false;

            // deviceType is the fifth 32-bit member of VkPhysicalDeviceProperties.
            // Allow room for the full ABI struct.
            var properties = Marshal.AllocHGlobal(4096);
            try
            {
                for (var i = 0; i < count; i++)
                {
                    vkGetPhysicalDeviceProperties(devices[i], properties);
                    int deviceType = Marshal.ReadInt32(properties, 16);
                    // Integrated, discrete or virtual GPU. CPU Vulkan devices are excluded.
                    if (deviceType >= 1 && deviceType <= 3 && HasComputeQueue(devices[i])) return true;
                }
                return false;
            }
            finally { Marshal.FreeHGlobal(properties); }
        }
        catch (DllNotFoundException) { return false; }
        finally
        {
            if (instance != IntPtr.Zero) vkDestroyInstance(instance, IntPtr.Zero);
        }
    }
}
'@

[UpscaleVulkanProbe]::HasCompatibleGpu()
