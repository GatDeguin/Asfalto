#include <stddef.h>
#include <stdint.h>
#include "libdeflate.h"

// One instance serves one asset. The host owns the pages and supplies exact
// lengths. The codec only allocates its tables inside this fixed scratch area.
namespace {
constexpr uint32_t payload_offset = 4 * 65536;
alignas(64) uint8_t decoder_scratch[65536];

void* allocate_decoder(size_t bytes) {
    return bytes <= sizeof(decoder_scratch) ? decoder_scratch : nullptr;
}

void release_decoder(void*) {}
}

extern "C" uint8_t __heap_base;

extern "C" uint32_t arena_base() {
    const auto static_end = reinterpret_cast<uintptr_t>(&__heap_base);
    return static_end > payload_offset ? static_end : payload_offset;
}

extern "C" int32_t decode_gzip(uint32_t input_size, uint32_t output_size) {
    const uint32_t base = arena_base();
    const uint32_t capacity = __builtin_wasm_memory_size(0) * 65536;
    if (base > capacity || input_size > capacity - base || input_size < 18) return 1;
    const uint32_t output = (base + input_size + 15) & ~uint32_t{15};
    if (output > capacity || output_size > capacity - output) return 1;

    const libdeflate_options options = {sizeof(options), allocate_decoder, release_decoder};
    auto* decoder = libdeflate_alloc_decompressor_ex(&options);
    if (!decoder) return 2;

    size_t consumed = 0;
    const auto status = libdeflate_gzip_decompress_ex(decoder,
        reinterpret_cast<const void*>(base), input_size,
        reinterpret_cast<void*>(output), output_size, &consumed, nullptr);
    libdeflate_free_decompressor(decoder);
    return status == LIBDEFLATE_SUCCESS && consumed == input_size ? 0 : 3;
}
